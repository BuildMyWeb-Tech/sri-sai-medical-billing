// app/api/store/products-for-billing/route.js
//
// ✅ Works for BOTH:
//    - Store owner (Clerk session via getAuth)
//    - Employee (JWT token via Authorization header)
//
// Returns products WITH variants (including barcode for scan)
// Used by: Store Billing, Employee Billing

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

async function resolveStoreId(request) {
  // ── 1. Try employee JWT first (Authorization: Bearer <empToken>) ──
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) {
      return { storeId: emp.storeId, role: 'EMPLOYEE' };
    }
  }

  // ── 2. Fall back to Clerk session (store owner) ──
  const { userId } = getAuth(request);
  if (userId) {
    const storeId = await authSeller(userId);
    if (storeId) return { storeId, role: 'STORE' };
  }

  return { storeId: null, role: null };
}

export async function GET(request) {
  try {
    const { storeId, role } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '200'));

    let where = { storeId };

    if (search) {
      const q = search.trim();
      where = {
        storeId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        mrp: true,
        price: true,
        images: true,
        category: true,
        quantity: true,
        inStock: true,
        sku: true,
        // ← Include variants WITH barcode (needed for barcode scan)
        variants: {
          select: {
            id: true,
            size: true,
            price: true,
            stock: true,
            barcode: true,
            productId: true,
          },
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ products, role });
  } catch (error) {
    console.error('GET /api/store/products-for-billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}