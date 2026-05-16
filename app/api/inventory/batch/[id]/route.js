// app/api/inventory/batch/[id]/route.js
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;  // Fix Issue 4 also
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const batch = await prisma.productBatch.findFirst({
      where: { id, product: { storeId } },
    });
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    if (batch.remainingQty !== batch.quantity) {
      return NextResponse.json({ error: 'Cannot delete — stock already sold from this batch' }, { status: 400 });
    }

    // STEP 1: Only critical deletes inside transaction — keep it minimal
    await prisma.$transaction(async (tx) => {
      await tx.billItem.updateMany({
        where: { batchId: id },
        data: { batchId: null },
      });
      await tx.productBatch.delete({ where: { id } });
    });

    // STEP 2: Stock recalculation OUTSIDE transaction — no timeout risk
    if (batch.variantId) {
      await prisma.productVariant.update({
        where: { id: batch.variantId },
        data: { stock: { decrement: batch.quantity } },
      });
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId: batch.productId },
      select: { stock: true },
    });
    const totalStock = variants.reduce((s, v) => s + v.stock, 0);

    await prisma.inventory.updateMany({
      where: { productId: batch.productId, storeId },
      data: { quantity: totalStock },
    });
    await prisma.product.update({
      where: { id: batch.productId },
      data: { quantity: totalStock, inStock: totalStock > 0 },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;  // Next.js 15 fix
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { quantity, expiryDate, batchNumber } = await request.json();

    const batch = await prisma.productBatch.findFirst({
      where: { id, product: { storeId } },
    });
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    if (batch.remainingQty !== batch.quantity) {
      return NextResponse.json({ error: 'Cannot edit — stock already sold from this batch' }, { status: 400 });
    }

    const newQty = quantity ? Number(quantity) : batch.quantity;
    const diff = newQty - batch.quantity;

    // STEP 1: Only batch update inside transaction
await prisma.$transaction(async (tx) => {
  await tx.productBatch.update({
    where: { id },
    data: {
      quantity:    newQty,
      remainingQty: newQty,
      expiryDate:  expiryDate ? new Date(expiryDate) : batch.expiryDate,
      batchNumber: batchNumber ?? batch.batchNumber,
    },
  });
});

// STEP 2: Stock recalculation OUTSIDE transaction
if (batch.variantId && diff !== 0) {
  await prisma.productVariant.update({
    where: { id: batch.variantId },
    data: { stock: { increment: diff } },
  });
}

const variants = await prisma.productVariant.findMany({
  where: { productId: batch.productId },
  select: { stock: true },
});
const totalStock = variants.reduce((s, v) => s + v.stock, 0);

await prisma.inventory.updateMany({
  where: { productId: batch.productId, storeId },
  data: { quantity: totalStock },
});
await prisma.product.update({
  where: { id: batch.productId },
  data: { quantity: totalStock, inStock: totalStock > 0 },
});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}