// app/api/inventory/route.js

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import authAdmin from '@/middlewares/authAdmin';
import { verifyEmployeeToken, hasPermission } from '@/middlewares/authEmployee';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Resolve storeId from Seller / Employee
// ─────────────────────────────────────────────
async function resolveStoreId(request, permission = 'inventory') {
  // Employee login
  const emp = verifyEmployeeToken(request);

  if (emp?.storeId) {
    if (!hasPermission(emp, permission)) {
      return { storeId: null, error: `No ${permission} permission` };
    }

    return {
      storeId: emp.storeId,
      isEmployee: true,
    };
  }

  // Seller login
  const { userId } = getAuth(request);

  if (!userId) {
    return { storeId: null, error: 'Unauthorized' };
  }

  const storeId = await authSeller(userId);

  if (!storeId) {
    return { storeId: null, error: 'Not authorized' };
  }

  return { storeId, userId };
}

// ─────────────────────────────────────────────
// GET /api/inventory
// ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    // Admin only
    if (all) {
      const { userId } = getAuth(request);

      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const isAdmin = await authAdmin(userId);

      if (!isAdmin) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const storeFilter = searchParams.get('storeId');

      const inventory = await prisma.inventory.findMany({
        where: storeFilter ? { storeId: storeFilter } : {},
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              price: true,
              inStock: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: { quantity: 'asc' },
      });

      return NextResponse.json({ inventory });
    }

    // Seller / Employee
    const { storeId, error } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const inventory = await prisma.inventory.findMany({
      where: { storeId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            price: true,
            inStock: true,
          },
        },
      },
      orderBy: { quantity: 'asc' },
    });

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error('GET /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/inventory
// Full create/update
// quantity + lowStock
// ─────────────────────────────────────────────

export async function POST(request) {
  try {
    const { storeId, error } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { productId, lowStock } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 });
    }

    if (lowStock === undefined || lowStock === null) {
      return NextResponse.json({ error: 'lowStock required' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Threshold-only update — NEVER overwrites quantity
    const inventory = await prisma.inventory.upsert({
      where: {
        productId_storeId: { productId, storeId },
      },
      update: {
        lowStock: Math.max(1, Number(lowStock)),
      },
      create: {
        productId,
        storeId,
        quantity: product.quantity || 0,
        lowStock: Math.max(1, Number(lowStock)),
      },
    });

    return NextResponse.json({
      message: 'Threshold updated',
      inventory,
    });
  } catch (error) {
    console.error('POST /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/inventory
// Threshold-only update
// ─────────────────────────────────────────────
export async function PATCH(request) {
  try {
    const { storeId, error } = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { productId, lowStock } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'productId required' },
        { status: 400 }
      );
    }

    if (lowStock === undefined || lowStock === null) {
      return NextResponse.json(
        { error: 'lowStock required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const inventory = await prisma.inventory.upsert({
      where: {
        productId_storeId: { productId, storeId },
      },
      update: {
        lowStock: Math.max(1, Number(lowStock)),
      },
      create: {
        productId,
        storeId,
        quantity: product.quantity || 0,
        lowStock: Math.max(1, Number(lowStock)),
      },
    });

    return NextResponse.json({
      message: 'Threshold updated',
      inventory,
    });
  } catch (error) {
    console.error('PATCH /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}