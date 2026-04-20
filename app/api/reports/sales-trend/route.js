// app/api/reports/sales-trend/route.js
// ✅ TIMEZONE FIX: day bucketing now uses IST date, not UTC date.
// ✅ TC-10 FIX: Returns 400 when custom range has missing from/to.
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildDateRange, round2, fmtDay } from '@/lib/reportUtils';
import authEmployee from '@/middlewares/authEmployee';

// REPLACE the resolveRole function:
async function resolveRole(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const emp = await authEmployee(token);  // import authEmployee
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

// ✅ Convert a UTC Date to IST YYYY-MM-DD string for bucketing
function toISTDateKey(utcDate) {
  return new Date(utcDate).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  }); // returns 'YYYY-MM-DD' format
}

export async function GET(request) {
  try {
    const identity = await resolveRole(request);
    if (!identity?.role) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const filterStore = searchParams.get('storeId');

    const dateRange = buildDateRange(period, from, to);
    if (!dateRange) {
      return NextResponse.json(
        { error: 'Custom period requires valid "from" and "to" dates' },
        { status: 400 }
      );
    }

    const scopedStoreId = identity?.role === 'ADMIN' ? filterStore || undefined : identity?.storeId;
    const scopedEmployeeId = identity?.employeeId || undefined;

    const where = {
      createdAt: dateRange,
      ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
      ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
    };

    const sales = await prisma.sale.findMany({
      where,
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // ✅ Bucket by IST date (not UTC date)
    // Without this fix, a sale at 10:30pm IST = 5pm UTC buckets to the wrong day
    const buckets = {};
    for (const sale of sales) {
      const key = toISTDateKey(sale.createdAt); // 'YYYY-MM-DD' in IST
      if (!buckets[key]) buckets[key] = { revenue: 0, count: 0 };
      buckets[key].revenue += sale.amount;
      buckets[key].count += 1;
    }

    // Fill every IST day in range — no gaps for charts
    const trend = [];
    const cursor = new Date(dateRange.gte);
    const end = new Date(dateRange.lte);
    while (cursor <= end) {
      const key = toISTDateKey(cursor); // IST date key
      const label = fmtDay(cursor); // IST-formatted label
      trend.push({
        date: key,
        label,
        revenue: round2(buckets[key]?.revenue || 0),
        count: buckets[key]?.count || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const totalRevenue = round2(sales.reduce((s, x) => s + x.amount, 0));
    const totalCount = sales.length;
    const peakDay = trend.reduce((best, d) => (d.revenue > (best?.revenue || 0) ? d : best), null);

    return NextResponse.json({
      trend,
      meta: {
        totalRevenue,
        totalCount,
        peakDay,
        period,
        from: dateRange.gte,
        to: dateRange.lte,
      },
    });
  } catch (error) {
    console.error('GET /api/reports/sales-trend error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
