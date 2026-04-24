// app/api/store/products-for-billing/route.js

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Resolve storeId (STORE + EMPLOYEE)
// ─────────────────────────────────────────────
async function resolveStoreId(request) {
  try {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) {
      return { storeId: emp.storeId, role: 'EMPLOYEE' };
    }
  } catch (_) {}

  try {
    const { userId } = getAuth(request);
    if (userId) {
      const storeId = await authSeller(userId);
      if (storeId) return { storeId, role: 'STORE' };
    }
  } catch (_) {}

  return { storeId: null, role: null };
}

// ─────────────────────────────────────────────
// GET PRODUCTS FOR BILLING
// ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId, role } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '200'));

    // ⚡ STEP 1: FAST BARCODE MATCH (FOR SCANNER)
    if (search) {
      const exactVariant = await prisma.productVariant.findFirst({
        where: {
          barcode: search,
          product: {
            storeId,
          },
        },
        include: {
          product: true,
        },
      });

      if (exactVariant) {
        return NextResponse.json({
          role,
          products: [
            {
              id: exactVariant.product.id,
              name: exactVariant.product.name,
              sku: exactVariant.product.sku,
              variants: [
                {
                  id: exactVariant.id,
                  size: exactVariant.size,
                  price: exactVariant.price,
                  stock: exactVariant.stock,
                  barcode: exactVariant.barcode,
                  productId: exactVariant.productId,
                },
              ],
            },
          ],
          type: 'BARCODE_MATCH',
        });
      }
    }

    // ⚡ STEP 2: NORMAL SEARCH (NAME / SKU / BARCODE PARTIAL)
    let where = { storeId };

    if (search) {
      where = {
        storeId,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          {
            variants: {
              some: {
                barcode: { contains: search },
              },
            },
          },
        ],
      };
    }

    // ⚡ STEP 3: FETCH PRODUCTS
    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
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

    // ⚡ STEP 4: REMOVE EMPTY VARIANT PRODUCTS (IMPORTANT)
    const filteredProducts = products.filter(p => p.variants.length > 0);

    return NextResponse.json({
      role,
      products: filteredProducts,
      type: 'SEARCH_RESULT',
    });

  } catch (error) {
    console.error('❌ products-for-billing error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}