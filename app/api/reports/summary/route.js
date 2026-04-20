// app/api/reports/summary/route.js
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import authEmployee from '@/middlewares/authEmployee';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildDateRange, buildComparisonRanges, calcGrowth, round2 } from '@/lib/reportUtils';

async function resolveIdentity(request) {
  // 1. Try employee JWT first (Authorization: Bearer <empToken>)
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const emp = await authEmployee(token);
      if (emp) {
        const hasAccess =
          emp.role === 'STORE_OWNER' || emp.permissions?.reports === true;
        return {
          role: 'EMPLOYEE',
          storeId: emp.storeId,
          employeeId: emp.id,
          canSeeAll: emp.role === 'STORE_OWNER',
          hasAccess,
        };
      }
    } catch {}
  }

  // 2. Clerk session (store owner / admin)
  const { userId } = getAuth(request);
  if (!userId) return null;

  const isAdmin = await authAdmin(userId);
  if (isAdmin) return { role: 'ADMIN', storeId: null, employeeId: null, canSeeAll: true, hasAccess: true };

  const storeId = await authSeller(userId);
  if (storeId) return { role: 'STORE', storeId, employeeId: null, canSeeAll: true, hasAccess: true };

  return null;
}

export async function GET(request) {
  try {
    const identity = await resolveIdentity(request);
    if (!identity) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    if (!identity.hasAccess) return NextResponse.json({ error: 'No permission to view reports' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const filterStore = searchParams.get('storeId');
    const comparison = searchParams.get('comparison');

    const dateRange = buildDateRange(period, from, to);
    if (!dateRange) {
      return NextResponse.json(
        { error: 'Custom period requires valid "from" and "to" dates' },
        { status: 400 }
      );
    }

    // Scope: admin can filter by store, store sees own, employee sees own bills only
    const scopedStoreId =
      identity.role === 'ADMIN'
        ? filterStore || undefined
        : identity.storeId;

    // Employee: only their own sales (where employeeId matches)
    const scopedEmployeeId =
      identity.role === 'EMPLOYEE' && !identity.canSeeAll
        ? identity.employeeId
        : undefined;

    const where = {
      createdAt: dateRange,
      ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
      ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
    };

    const agg = await prisma.sale.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
    });

    const revenue = round2(agg._sum.amount || 0);
    const orders = agg._count.id || 0;
    const aov = round2(agg._avg.amount || 0);

    // Employee breakdown — only for store/admin role
    let employeeBreakdown = null;
    if (identity.role !== 'EMPLOYEE' || identity.canSeeAll) {
      const byEmployee = await prisma.sale.groupBy({
        by: ['employeeId'],
        where: { ...where, employeeId: { not: null } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
      });

      if (byEmployee.length > 0) {
        const empIds = byEmployee.map((e) => e.employeeId).filter(Boolean);
        const employees = await prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, name: true, email: true },
        });
        const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

        employeeBreakdown = byEmployee.map((e) => ({
          employeeId: e.employeeId,
          name: empMap[e.employeeId]?.name || 'Unknown',
          email: empMap[e.employeeId]?.email || '',
          revenue: round2(e._sum.amount || 0),
          bills: e._count.id || 0,
        }));
      }
    }

    // Top store — admin only
    let topStore = null;
    if (identity.role === 'ADMIN' && !filterStore) {
      const topStoreRaw = await prisma.sale.groupBy({
        by: ['storeId'],
        where: { createdAt: dateRange },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 1,
      });
      if (topStoreRaw.length > 0) {
        const storeData = await prisma.store.findUnique({
          where: { id: topStoreRaw[0].storeId },
          select: { id: true, name: true, logo: true, username: true },
        });
        topStore = { ...storeData, revenue: round2(topStoreRaw[0]._sum.amount || 0) };
      }
    }

    // Comparison
    let comparisonData = null;
    if (comparison) {
      const ranges = buildComparisonRanges(comparison);
      if (ranges) {
        const storeFilter = scopedStoreId ? { storeId: scopedStoreId } : {};
        const empFilter = scopedEmployeeId ? { employeeId: scopedEmployeeId } : {};

        const [curr, prev] = await Promise.all([
          prisma.sale.aggregate({
            where: { createdAt: ranges.current, ...storeFilter, ...empFilter },
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.sale.aggregate({
            where: { createdAt: ranges.previous, ...storeFilter, ...empFilter },
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        const currRev = round2(curr._sum.amount || 0);
        const prevRev = round2(prev._sum.amount || 0);
        const currOrds = curr._count.id || 0;
        const prevOrds = prev._count.id || 0;

        const revGrowth = calcGrowth(currRev, prevRev);
        const ordGrowth = calcGrowth(currOrds, prevOrds);

        comparisonData = {
          labels: ranges.labels,
          revenue: { current: currRev, previous: prevRev, growth: revGrowth.growth, note: revGrowth.note },
          orders: { current: currOrds, previous: prevOrds, growth: ordGrowth.growth, note: ordGrowth.note },
        };
      }
    }

    return NextResponse.json({
      summary: {
        revenue,
        orders,
        aov,
        topStore,
        employeeBreakdown,
        period,
        dateRange: { from: dateRange.gte, to: dateRange.lte },
        comparison: comparisonData,
        // Tell the frontend which scope this response covers
        scope: identity.role === 'EMPLOYEE' && !identity.canSeeAll ? 'employee' : 'store',
      },
    });
  } catch (error) {
    console.error('GET /api/reports/summary error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}