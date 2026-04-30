// app/api/inventory/deduct/route.js

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken, hasPermission } from '@/middlewares/authEmployee';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Resolve storeId
// ─────────────────────────────────────────────
async function resolveStoreId(request) {
  const emp = verifyEmployeeToken(request);

  if (emp?.storeId) {
    if (!hasPermission(emp, 'billing')) {
      return { storeId: null, error: 'No billing permission' };
    }

    return { storeId: emp.storeId };
  }

  const { userId } = getAuth(request);

  if (!userId) {
    return { storeId: null, error: 'Unauthorized' };
  }

  const storeId = await authSeller(userId);

  if (!storeId) {
    return { storeId: null, error: 'Not authorized' };
  }

  return { storeId };
}

// ─────────────────────────────────────────────
// POST /api/inventory/deduct
// ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId, error } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { items = [] } = await request.json();

    if (!items.length) {
      return NextResponse.json({
        message: 'No items to deduct',
        deducted: [],
      });
    }

    const deducted = [];
    const errors = [];

    for (const item of items) {
      const deductQty = Number(item.quantity);

      if (!deductQty || deductQty <= 0) continue;

      try {
        // ─────────────────────────────
        // Variant deduction
        // ─────────────────────────────
        if (item.variantId) {
          const cleanId =
            item.variantId.includes('_') &&
            item.variantId.length > 30
              ? item.variantId.split('_')[0]
              : item.variantId;

          await prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({
              where: { id: cleanId },
              select: {
                id: true,
                stock: true,
                productId: true,
              },
            });

            if (!variant) return;

            const newStock = Math.max(0, variant.stock - deductQty);

            await tx.productVariant.update({
              where: { id: cleanId },
              data: { stock: newStock },
            });

            const variants = await tx.productVariant.findMany({
              where: { productId: variant.productId },
              select: { stock: true },
            });

            const totalStock = variants.reduce(
              (sum, row) => sum + row.stock,
              0
            );

            await tx.product.update({
              where: { id: variant.productId },
              data: {
                quantity: totalStock,
                inStock: totalStock > 0,
              },
            });

            await tx.inventory.upsert({
              where: {
                productId_storeId: {
                  productId: variant.productId,
                  storeId,
                },
              },
              update: {
                quantity: totalStock,
              },
              create: {
                productId: variant.productId,
                storeId,
                quantity: totalStock,
                lowStock: 10,
              },
            });

            deducted.push({
  variantId: cleanId,
  productId: variant.productId,
  deducted: deductQty,
  newStock,
  newProductStock: totalStock,
  lowStock: newStock <= 10, // ✅ flag for client
});
          });
        }

        // ─────────────────────────────
        // Product deduction
        // ─────────────────────────────
        else if (item.productId) {
          await prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
              where: {
                id: item.productId,
                storeId,
              },
              select: {
                id: true,
                quantity: true,
              },
            });

            if (!product) return;

            const inv = await tx.inventory.findUnique({
              where: {
                productId_storeId: {
                  productId: item.productId,
                  storeId,
                },
              },
            });

            const currentQty =
              inv?.quantity ?? product.quantity ?? 0;

            const newQty = Math.max(0, currentQty - deductQty);

            await tx.inventory.upsert({
              where: {
                productId_storeId: {
                  productId: item.productId,
                  storeId,
                },
              },
              update: {
                quantity: newQty,
              },
              create: {
                productId: item.productId,
                storeId,
                quantity: newQty,
                lowStock: 10,
              },
            });

            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQty,
                inStock: newQty > 0,
              },
            });

            deducted.push({
              productId: item.productId,
              deducted: deductQty,
              newQty,
            });
          });
        }
      } catch (err) {
        console.error('Deduct error:', err);

        errors.push({
          item,
          reason: err.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Deduction complete',
      deducted,
      errors,
    });
  } catch (error) {
    console.error('POST /api/inventory/deduct error:', error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}