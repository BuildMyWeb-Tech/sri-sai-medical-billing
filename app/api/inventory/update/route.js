// app/api/inventory/route.js
// Threshold-only update — never touches quantity
import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { productId, lowStock } = await request.json();
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
    if (lowStock === undefined || lowStock === null)
      return NextResponse.json({ error: 'lowStock required' }, { status: 400 });

    const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const inventory = await prisma.inventory.upsert({
      where: { productId_storeId: { productId, storeId } },
      update: { lowStock: Math.max(1, Number(lowStock)) },
      create: { productId, storeId, quantity: 0, lowStock: Math.max(1, Number(lowStock)) },
    });

    return NextResponse.json({ message: 'Threshold updated', inventory });
  } catch (error) {
    console.error('POST /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}