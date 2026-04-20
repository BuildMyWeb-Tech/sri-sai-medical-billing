// app/api/reports/export/route.js
// ✅ TC-10 FIX: Returns 400 when custom range has missing from/to
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { buildDateRange, round2 } from '@/lib/reportUtils';

async function resolveRole(request) {
  const { userId } = getAuth(request);
  if (!userId) return { role: null, storeId: null };
  const isAdmin = await authAdmin(userId);
  if (isAdmin) return { role: 'ADMIN', storeId: null };
  const storeId = await authSeller(userId);
  if (storeId) return { role: 'STORE', storeId };
  return { role: null, storeId: null };
}

function toCSV(rows, columns) {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key] ?? '';
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      })
      .join(',')
  );
  return [header, ...body].join('\n');
}

export async function GET(request) {
  try {
    const { role, storeId: myStoreId } = await resolveRole(request);
    if (!role) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const period = searchParams.get('period') || 'month';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const filterStore = searchParams.get('storeId');

    // ✅ TC-10 FIX
    const dateRange = buildDateRange(period, from, to);
    if (!dateRange) {
      return NextResponse.json(
        { error: 'Custom period requires valid "from" and "to" dates' },
        { status: 400 }
      );
    }

    const scopedStoreId = role === 'ADMIN' ? filterStore || undefined : myStoreId;

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: dateRange,
        ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
      },
      include: { store: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const rows = sales.map((s) => ({
      id: s.id,
      storeName: s.store?.name || '',
      storeId: s.storeId,
      amount: round2(s.amount),
      source: s.source,
      referenceId: s.referenceId,
      date: s.createdAt.toISOString().split('T')[0],
      time: s.createdAt.toTimeString().split(' ')[0],
    }));

    const columns = [
      { key: 'id', label: 'Sale ID' },
      { key: 'storeName', label: 'Store' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'source', label: 'Source' },
      { key: 'referenceId', label: 'Reference ID' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
    ];

    if (format === 'csv') {
      const csv = toCSV(rows, columns);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sales-report-${period}-${Date.now()}.csv"`,
        },
      });
    }

    // PDF: return structured JSON for client-side rendering
    const totalRevenue = round2(rows.reduce((s, r) => s + r.amount, 0));
    const summary = {
      totalRevenue,
      totalOrders: rows.length,
      aov: rows.length > 0 ? round2(totalRevenue / rows.length) : 0,
      period,
      from: dateRange.gte.toISOString().split('T')[0],
      to: dateRange.lte.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ format: 'pdf', summary, rows, columns });
  } catch (error) {
    console.error('GET /api/reports/export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
