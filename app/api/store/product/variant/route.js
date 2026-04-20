// app/api/store/product/variant/route.js
// PATCH /api/store/product/variant?id=<variantId>
// Inline update of a single variant's price or stock.
// Auth: store owner (Clerk) only — employees see variants read-only.

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function PATCH(request) {
  try {
    const { userId } = getAuth(request);
    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get('id');
    if (!variantId) return NextResponse.json({ error: 'Variant ID required' }, { status: 400 });

    const body = await request.json();
    const { price, stock } = body;

    // Verify the variant belongs to a product owned by this store
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { storeId: true } } },
    });

    if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    if (variant.product.storeId !== storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Build update payload
    const updateData = {};
    if (price !== undefined) {
      const num = Number(price);
      if (isNaN(num) || num <= 0)
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      updateData.price = num;
    }
    if (stock !== undefined) {
      const num = Math.max(0, Number(stock));
      updateData.stock = num;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVariant = await tx.productVariant.update({
        where: { id: variantId },
        data: updateData,
        select: { id: true, size: true, price: true, stock: true, productId: true },
      });

      // If stock changed → re-aggregate product quantity + inStock
      if (stock !== undefined) {
        const allVariants = await tx.productVariant.findMany({
          where: { productId: variant.productId },
          select: { stock: true },
        });
        const totalStock = allVariants.reduce((sum, v) => sum + v.stock, 0);
        await tx.product.update({
          where: { id: variant.productId },
          data: { quantity: totalStock, inStock: totalStock > 0 },
        });
        // Sync inventory
        await tx.inventory.updateMany({
          where: { productId: variant.productId, storeId },
          data: { quantity: totalStock },
        });
      }

      return updatedVariant;
    });

    return NextResponse.json({ message: 'Variant updated', variant: updated });
  } catch (error) {
    console.error('PATCH /api/store/product/variant error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
