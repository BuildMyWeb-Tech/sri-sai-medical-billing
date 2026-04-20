// app/api/reports/top-stores/route.js
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildDateRange, round2 } from '@/lib/reportUtils';

export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const isAdmin = await authAdmin(userId);
    if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const sortBy = searchParams.get('sortBy') || 'revenue';

    const dateRange = buildDateRange(period, from, to);

    // ── groupBy storeId on Sale table ─────────────────────────────
    const grouped = await prisma.sale.groupBy({
      by: ['storeId'],
      where: { createdAt: dateRange },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: sortBy === 'orders' ? { _count: { id: 'desc' } } : { _sum: { amount: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) {
      return NextResponse.json({ stores: [], meta: { period, total: 0 } });
    }

    // ── Fetch store metadata ──────────────────────────────────────
    const storeIds = grouped.map((g) => g.storeId);
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true, logo: true, username: true, email: true },
    });
    const storeMap = Object.fromEntries(stores.map((s) => [s.id, s]));

    const totalRevenue = grouped.reduce((s, g) => s + (g._sum.amount || 0), 0);

    const result = grouped.map((g, idx) => {
      const s = storeMap[g.storeId] || {};
      const rev = round2(g._sum.amount || 0);
      return {
        rank: idx + 1,
        storeId: g.storeId,
        name: s.name || 'Unknown Store',
        logo: s.logo || null,
        username: s.username || '',
        email: s.email || '',
        revenue: rev,
        orders: g._count.id || 0,
        share: totalRevenue > 0 ? round2((rev / totalRevenue) * 100) : 0,
        aov: g._count.id > 0 ? round2(rev / g._count.id) : 0,
      };
    });

    return NextResponse.json({
      stores: result,
      meta: {
        period,
        total: round2(totalRevenue),
        count: result.length,
        sortBy,
        from: dateRange.gte,
        to: dateRange.lte,
      },
    });
  } catch (error) {
    console.error('GET /api/reports/top-stores error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
