// app/api/inventory/batch/route.js

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {

    // ─────────────────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────────────────

    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storeId = await authSeller(userId);

    if (!storeId) {
      return NextResponse.json(
        { error: 'Not a store owner' },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // BODY
    // ─────────────────────────────────────────────────────────

    const {
      productId,
      variantId,
      quantity,
      expiryDate,
      batchNumber,
    } = await request.json();

    // ─────────────────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────────────────

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // VERIFY PRODUCT
    // ─────────────────────────────────────────────────────────

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        storeId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // VERIFY VARIANT
    // ─────────────────────────────────────────────────────────

    if (variantId) {

      const variant = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId,
        },
        select: {
          id: true,
        },
      });

      if (!variant) {
        return NextResponse.json(
          { error: 'Variant not found' },
          { status: 404 }
        );
      }
    }

    // ─────────────────────────────────────────────────────────
    // OPTIONAL EXPIRY
    // ─────────────────────────────────────────────────────────

    const expiry = expiryDate
      ? new Date(expiryDate)
      : null;

    // ─────────────────────────────────────────────────────────
    // TRANSACTION
    // ONLY CREATE BATCH INSIDE TRANSACTION
    // KEEP IT VERY FAST
    // ─────────────────────────────────────────────────────────

    const result = await prisma.$transaction(
      async (tx) => {

        // ─────────────────────────────────────────────────────
        // DUPLICATE GUARD
        // Prevent duplicate stock creation
        // ─────────────────────────────────────────────────────

        const recentCutoff = new Date(
          Date.now() - 10000
        );

        const existing = await tx.productBatch.findFirst({
          where: {
            productId,
            variantId: variantId || null,
            quantity: qty,
            expiryDate: expiry,
            createdAt: {
              gte: recentCutoff,
            },
          },
        });

        // Duplicate request found
        if (existing) {
          return {
            batch: existing,
            duplicate: true,
          };
        }

        // ─────────────────────────────────────────────────────
        // CREATE BATCH
        // ─────────────────────────────────────────────────────

        const batch = await tx.productBatch.create({
          data: {
            productId,
            variantId: variantId || null,
            batchNumber:
              batchNumber?.trim() || null,
            expiryDate: expiry,
            quantity: qty,
            remainingQty: qty,
          },
        });

        return {
          batch,
          duplicate: false,
        };
      },

      // optional timeout increase
      {
        timeout: 10000,
      }
    );

    // ─────────────────────────────────────────────────────────
    // SKIP STOCK UPDATE IF DUPLICATE
    // ─────────────────────────────────────────────────────────

    let totalStock = null;

    if (!result.duplicate) {

      // ───────────────────────────────────────────────────────
      // UPDATE VARIANT STOCK
      // ───────────────────────────────────────────────────────

      if (variantId) {

        const updatedVariant =
          await prisma.productVariant.update({
            where: {
              id: variantId,
            },
            data: {
              stock: {
                increment: qty,
              },
            },
            select: {
              stock: true,
            },
          });

        totalStock = updatedVariant.stock;
      }

      // ───────────────────────────────────────────────────────
      // UPDATE PRODUCT STOCK
      // ───────────────────────────────────────────────────────

      await prisma.product.update({
        where: {
          id: productId,
        },
        data: {
          quantity: {
            increment: qty,
          },
          inStock: true,
        },
      });

      // ───────────────────────────────────────────────────────
      // UPSERT INVENTORY
      // ───────────────────────────────────────────────────────

      const existingInventory =
        await prisma.inventory.findUnique({
          where: {
            productId_storeId: {
              productId,
              storeId,
            },
          },
        });

      if (existingInventory) {

        await prisma.inventory.update({
          where: {
            productId_storeId: {
              productId,
              storeId,
            },
          },
          data: {
            quantity: {
              increment: qty,
            },
          },
        });

      } else {

        await prisma.inventory.create({
          data: {
            productId,
            storeId,
            quantity: qty,
            lowStock: 10,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────
    // SUCCESS RESPONSE
    // ─────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      duplicate: result.duplicate || false,
      batch: result.batch,
      totalStock,
      message: result.duplicate
        ? 'Duplicate request prevented'
        : 'Stock added successfully',
    });

  } catch (error) {

    console.error(
      'POST /api/inventory/batch error:',
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