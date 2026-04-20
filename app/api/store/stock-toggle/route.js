// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\app\api\store\stock-toggle\route.js
import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── POST: Toggle inStock boolean ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'missing details: productId' }, { status: 400 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      return NextResponse.json({ error: 'no product found' }, { status: 404 });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { inStock: !product.inStock },
    });

    return NextResponse.json({ message: 'Product stock updated successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}

// ── PATCH: Update stock quantity ─────────────────────────────────────────────
// Body: { productId: string, quantity: number }
export async function PATCH(request) {
  try {
    const { userId } = getAuth(request);
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || quantity === undefined || quantity === null) {
      return NextResponse.json({ error: 'Missing productId or quantity' }, { status: 400 });
    }

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty) || parsedQty < 0) {
      return NextResponse.json(
        { error: 'Quantity must be a non-negative number' },
        { status: 400 }
      );
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        quantity: parsedQty,
        inStock: parsedQty > 0, // auto-toggle inStock based on qty
      },
    });

    return NextResponse.json({
      message: 'Stock updated successfully',
      quantity: updated.quantity,
      inStock: updated.inStock,
    });
  } catch (error) {
    console.error('PATCH /api/store/stock-toggle error:', error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
