// app/api/store/products-light/route.js
// Lightweight product list for dropdowns — no images, no heavy includes
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

async function resolveStoreId(request) {
  try { const emp = verifyEmployeeToken(request); if (emp?.storeId) return emp.storeId; } catch (_) {}
  const { userId } = getAuth(request);
  if (!userId) return null;
  return await authSeller(userId);
}

export async function GET(request) {
  try {
    const storeId = await resolveStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

   const products = await prisma.product.findMany({
  where: { storeId, isDeleted: false }, // ← remove inStock filter
      select: {
        id: true,
        name: true,
        variants: {
  select: { id: true, size: true, stock: true, price: true, barcode: true },
  orderBy: { size: 'asc' },
},
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}