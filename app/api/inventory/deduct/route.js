// app/api/inventory/deduct/route.js

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import {
  verifyEmployeeToken,
  hasPermission,
} from '@/middlewares/authEmployee';

import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Resolve Store ID
// ─────────────────────────────────────────────

async function resolveStoreId(request) {
  let emp = null;

  try {
    emp = verifyEmployeeToken(request);
  } catch (_) {}

  if (emp?.storeId) {
    if (!hasPermission(emp, 'billing')) {
      return {
        storeId: null,
        error: 'No billing permission',
      };
    }

    return {
      storeId: emp.storeId,
    };
  }

  const { userId } = getAuth(request);

  if (!userId) {
    return {
      storeId: null,
      error: 'Unauthorized',
    };
  }

  const storeId = await authSeller(userId);

  if (!storeId) {
    return {
      storeId: null,
      error: 'Not authorized',
    };
  }

  return { storeId };
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(request) {
  try {
    const { storeId, error } =
      await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { items = [] } =
      await request.json();

    if (!items.length) {
      return NextResponse.json({
        message: 'No items to deduct',
        deducted: [],
      });
    }

    const deducted = [];
    const errors = [];

    // ─────────────────────────────────────
    // PROCESS EACH ITEM
    // ─────────────────────────────────────

    for (const item of items) {
      try {
        const deductQty = Number(item.quantity);

        if (!deductQty || deductQty <= 0) {
          continue;
        }

        // ─────────────────────────────
        // VARIANT STOCK
        // ─────────────────────────────

        if (item.variantId) {
          const cleanId = String(item.variantId).split('_')[0];

          await prisma.$transaction(async (tx) => {

            // ─────────────────────
            // GET VARIANT
            // ─────────────────────

            const variant =
              await tx.productVariant.findUnique({
                where: {
                  id: cleanId,
                },
                select: {
                  id: true,
                  stock: true,
                  productId: true,
                },
              });

            if (!variant) {
              throw new Error(
                'Variant not found'
              );
            }

            // ─────────────────────
            // VALIDATE VARIANT STOCK
            // ─────────────────────

            if (variant.stock < deductQty) {
              throw new Error(
                `Insufficient variant stock. Available: ${variant.stock}`
              );
            }

            // ─────────────────────
            // VALIDATE BATCH
            // ─────────────────────

            if (item.batchId) {
  console.log('[DEDUCT] Looking for batchId:', item.batchId);
  
  const batch = await tx.productBatch.findUnique({
    where: { id: item.batchId },
    select: { id: true, variantId: true, remainingQty: true },
  });

  console.log('[DEDUCT] Batch found:', batch);

  if (!batch) { throw new Error('Batch not found: ' + item.batchId); }

  if (batch.remainingQty < deductQty) {
    throw new Error(`Insufficient batch qty. Available: ${batch.remainingQty}, Needed: ${deductQty}`);
  }

  await tx.productBatch.update({
    where: { id: item.batchId },
    data: { remainingQty: { decrement: deductQty } },
  });
  
  console.log('[DEDUCT] Batch decremented by', deductQty);
}

            // ─────────────────────
            // DEDUCT VARIANT STOCK
            // ─────────────────────

            await tx.productVariant.update({
              where: {
                id: cleanId,
              },
              data: {
                stock: {
                  decrement: deductQty,
                },
              },
            });

            // ─────────────────────
            // RECALCULATE PRODUCT
            // ─────────────────────

            const variants =
              await tx.productVariant.findMany({
                where: {
                  productId: variant.productId,
                },
                select: {
                  stock: true,
                },
              });

            const totalStock =
              variants.reduce(
                (sum, row) =>
                  sum + row.stock,
                0
              );

            // ─────────────────────
            // UPDATE PRODUCT
            // ─────────────────────

            await tx.product.update({
              where: {
                id: variant.productId,
              },
              data: {
                quantity: totalStock,
                inStock: totalStock > 0,
              },
            });

            // ─────────────────────
            // UPDATE INVENTORY
            // ─────────────────────

            await tx.inventory.upsert({
              where: {
                productId_storeId: {
                  productId:
                    variant.productId,
                  storeId,
                },
              },
              update: {
                quantity: totalStock,
              },
              create: {
                productId:
                  variant.productId,
                storeId,
                quantity: totalStock,
                lowStock: 5,
              },
            });

            deducted.push({
              variantId: cleanId,
              deducted: deductQty,
              remainingVariantStock:
                variant.stock - deductQty,
              totalProductStock:
                totalStock,
            });
          });
        }

      } catch (err) {
        console.error(
          'Deduction error:',
          err
        );

        errors.push({
          item,
          reason: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      deducted,
      errors,
    });

  } catch (error) {
    console.error(
      'POST /api/inventory/deduct error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          'Internal server error',
      },
      {
        status: 500,
      }
    );
  }
}