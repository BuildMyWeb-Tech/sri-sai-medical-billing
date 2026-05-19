// app/api/inventory/batches/route.js
// GET → Returns all ProductBatch rows for the store with expiry status
// Auth → Store Owner (authSeller) OR Employee with inventory permission

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken, hasPermission } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

async function resolveStoreId(request) {
  // Try employee token first
  let emp = null;
  try { emp = verifyEmployeeToken(request); } catch (_) {}

  if (emp?.storeId) {
    if (!hasPermission(emp, 'inventory')) {
      return { storeId: null, error: 'No inventory permission' };
    }
    return { storeId: emp.storeId };
  }

  // Fall back to Clerk seller auth
  const { userId } = getAuth(request);
  if (!userId) return { storeId: null, error: 'Unauthorized' };

  const storeId = await authSeller(userId);
  if (!storeId) return { storeId: null, error: 'Not authorized' };

  return { storeId };
}

export async function GET(request) {
  try {
    const { storeId, error } = await resolveStoreId(request);
    if (!storeId) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

   const { searchParams } = new URL(request.url);
const search        = searchParams.get('search') || '';
const pageParam     = parseInt(searchParams.get('page') || '1');
const limitParam = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
const skipParam     = (pageParam - 1) * limitParam;
    const batchSearch = searchParams.get('batch') || '';
    const expiryFilter = searchParams.get('expiry') || ''; // 'expired' | 'critical' | 'soon' | ''
    const variantIdFilter = searchParams.get('variantId') || ''; // ← ADD


    const now      = new Date();
    const in7days  = new Date(now); in7days.setDate(now.getDate() + 7);
    const in30days = new Date(now); in30days.setDate(now.getDate() + 30);

    // Build where clause for expiry filter
    let expiryWhere = {};
   if (expiryFilter === 'expired') {
  expiryWhere = { expiryDate: { not: null, lt: now } };
} else if (expiryFilter === 'critical') {
  expiryWhere = { expiryDate: { not: null, gte: now, lte: in7days } };
} else if (expiryFilter === 'soon') {
  expiryWhere = { expiryDate: { not: null, gte: now, lte: in30days } };
} else if (expiryFilter === 'none') {
  expiryWhere = { expiryDate: null };
}

const batches = await prisma.productBatch.findMany({
  where:  {
    remainingQty: { gt: 0 },
    product: { storeId },
    // If variantId provided directly — most specific filter
...(variantIdFilter ? {
  OR: [
    { variantId: variantIdFilter },
    { variantId: { startsWith: variantIdFilter + '_' } },
  ]
} : {}),
    ...(search && !variantIdFilter ? {
      product: {
        storeId,
        name: { contains: search, mode: 'insensitive' },
      },
    } : {}),
    ...(batchSearch ? {
      batchNumber: { contains: batchSearch, mode: 'insensitive' },
    } : {}),
    ...expiryWhere,
  },
     select: {
  id:           true,
  variantId:    true,
  batchNumber:  true,
  expiryDate:   true,
  quantity:     true,
  remainingQty: true,
  createdAt:    true,
  product: { select: { id: true, name: true } },
  variant: { select: { id: true, size: true } },
},
 orderBy: [
  { expiryDate: 'asc' },
  { createdAt: 'asc' },
],
  skip: skipParam,
  take: limitParam,
});
  

    // ── Attach expiry status to each batch ────────────────────
   const batchesWithStatus = batches.map((b) => {
  if (!b.expiryDate) return { ...b, status: 'none' }; // null expiry = no status
  const expiry = new Date(b.expiryDate);
  let status = 'ok';
  if (expiry < now)              status = 'expired';
  else if (expiry <= in7days)    status = 'critical';
  else if (expiry <= in30days)   status = 'soon';

  return { ...b, status };
});

const [expired, critical, soon] = await Promise.all([
  prisma.productBatch.count({
    where: {
      remainingQty: { gt: 0 },
      product: { storeId },
      expiryDate: { not: null, lt: now },
    },
  }),

  prisma.productBatch.count({
    where: {
      remainingQty: { gt: 0 },
      product: { storeId },
      expiryDate: { not: null, gte: now, lte: in7days },
    },
  }),

  prisma.productBatch.count({
    where: {
      remainingQty: { gt: 0 },
      product: { storeId },
      expiryDate: { not: null, gte: now, lte: in30days },
    },
  }),
]);

const expirySummary = {
  expired,
  critical,
  soon,
};

    return NextResponse.json({
      batches: batchesWithStatus,
      expirySummary,
      total: batchesWithStatus.length,
    });
  } catch (error) {
    console.error('GET /api/inventory/batches error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}