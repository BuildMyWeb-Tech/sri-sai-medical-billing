// app/api/reports/top-products/route.js
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/top-products
//
// Joins OrderItem → Sale via referenceId (orderId) to rank products.
// Returns top N products by revenue for the Pie chart.
//
// Query params:
//   period, from, to, storeId  (same as other report routes)
//   limit   = number of products to return (default 10)
// ─────────────────────────────────────────────────────────────────────────────
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildDateRange, round2 } from '@/lib/reportUtils';
import authEmployee from '@/middlewares/authEmployee';

async function resolveRole(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const emp = await authEmployee(token);
      if (emp) {
        return {
          role: 'EMPLOYEE',
          storeId: emp.storeId,
          employeeId: emp.role === 'STORE_OWNER' ? null : emp.id,
        };
      }
    } catch {}
  }

  const { userId } = getAuth(request);
  if (!userId) return { role: null, storeId: null, employeeId: null };
  const isAdmin = await authAdmin(userId);
  if (isAdmin) return { role: 'ADMIN', storeId: null, employeeId: null };
  const storeId = await authSeller(userId);
  if (storeId) return { role: 'STORE', storeId, employeeId: null };
  return { role: null, storeId: null, employeeId: null };
}

export async function GET(request) {
  try {
    const { role, storeId: myStoreId } = await resolveRole(request);
    if (!role) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period      = searchParams.get('period')  || 'month';
    const from        = searchParams.get('from');
    const to          = searchParams.get('to');
    const filterStore = searchParams.get('storeId');
    const limit       = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const scopedStoreId = role === 'ADMIN' ? (filterStore || undefined) : myStoreId;
    const dateRange = buildDateRange(period, from, to);

    // ── 1. Get all Sale referenceIds (orderIds) in the date range ─
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: dateRange,
        ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
        ...(identity.employeeId ? { employeeId: identity.employeeId } : {}),
      },
      select: { referenceId: true },
    });

    const orderIds = sales.map((s) => s.referenceId);
    if (orderIds.length === 0) {
      return NextResponse.json({ products: [], meta: { period, total: 0 } });
    }

    // ── 2. Aggregate OrderItems for those orders ──────────────────
    const items = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { orderId: { in: orderIds } },
      _sum: { price: true, quantity: true },
      _count: { orderId: true },
      orderBy: { _sum: { price: 'desc' } },
      take: limit,
    });

    if (items.length === 0) {
      return NextResponse.json({ products: [], meta: { period, total: 0 } });
    }

    // ── 3. Fetch product names + images ───────────────────────────
    const productIds = items.map((i) => i.productId);
    const products   = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, images: true, category: true, price: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    // ── 4. Build result ───────────────────────────────────────────
    const totalRevenue = items.reduce((s, i) => s + (i._sum.price || 0), 0);

    const result = items.map((item) => {
      const p   = productMap[item.productId] || {};
      const rev = round2(item._sum.price || 0);
      return {
        productId: item.productId,
        name:      p.name || 'Unknown Product',
        image:     p.images?.[0] || null,
        category:  p.category || [],
        revenue:   rev,
        quantity:  item._sum.quantity || 0,
        orders:    item._count.orderId || 0,
        share:     totalRevenue > 0 ? round2((rev / totalRevenue) * 100) : 0,
      };
    });

    return NextResponse.json({
      products: result,
      meta: { period, total: round2(totalRevenue), count: result.length },
    });
  } catch (error) {
    console.error('GET /api/reports/top-products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}