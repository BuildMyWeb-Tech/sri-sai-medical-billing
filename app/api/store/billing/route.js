// app/api/store/billing/route.js
// ─────────────────────────────────────────────────────────────────────────────
// CHANGE LOG vs previous version:
//   • POST now reads paidAmount + changeAmount from each bill object
//   • Passes them through to prisma.bill.create
//   • GET returns paidAmount + changeAmount in bill objects
//   • Everything else (auth, dedup, sale record, no double-stock) unchanged
// ─────────────────────────────────────────────────────────────────────────────
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken, hasPermission } from '@/middlewares/authEmployee';

async function resolveStoreId(request) {
  try {
    const employee = verifyEmployeeToken(request);
    if (employee?.storeId) {
      if (!hasPermission(employee, 'billing'))
        return { error: 'No billing permission', status: 403 };
      return { storeId: employee.storeId, source: 'employee' };
    }
  } catch (_) {}
  try {
    const { userId } = getAuth(request);
    if (userId) {
      const storeId = await authSeller(userId);
      if (storeId) return { storeId, source: 'owner' };
    }
  } catch (_) {}
  return { error: 'Unauthorized', status: 401 };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — sync bills array from IndexedDB queue
// ONLY saves Bill + BillItems + Sale. Does NOT touch stock.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId, error, status } = await resolveStoreId(request);
    if (!storeId)
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: status || 401 });

    const body = await request.json();
    const bills = Array.isArray(body) ? body : [body];

    const saved = [], failed = [], skipped = [];

    for (const bill of bills) {
      try {
        const {
          localId,
          billNumber,
          subtotal,
          discount    = 0,
          taxAmount   = 0,
          total,
          paymentMode = 'CASH',
          note,
          items       = [],
          createdAt,
          // ── NEW: cash-change fields (optional, undefined for non-cash) ──
          paidAmount,
          changeAmount,
        } = bill;

        if (!billNumber || !total || !items.length) {
          failed.push({ localId, reason: 'Missing required fields' });
          continue;
        }

        // Dedup — skip if already synced
        const existing = await prisma.bill.findFirst({
          where: { storeId, billNumber },
          select: { id: true },
        });
        if (existing) {
          skipped.push({ localId, billId: existing.id, reason: 'duplicate' });
          continue;
        }

        const created = await prisma.$transaction(async (tx) => {
          const newBill = await tx.bill.create({
            data: {
              billNumber,
              storeId,
              subtotal:     Number(subtotal),
              discount:     Number(discount),
              taxAmount:    Number(taxAmount),
              total:        Number(total),
              paymentMode,
              note:         note || null,
              createdAt:    createdAt ? new Date(createdAt) : new Date(),
              // ── Cash-change (null for non-cash bills) ──
              paidAmount:   paidAmount   != null ? Number(paidAmount)   : null,
              changeAmount: changeAmount != null ? Number(changeAmount) : null,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId || null,
                  name:      item.name,
                  size:      item.size || null,
                  price:     Number(item.price),
                  quantity:  Number(item.quantity),
                  discount:  Number(item.discount || 0),
                  total:     Number(item.total),
                })),
              },
            },
          });

          await tx.sale.create({
            data: {
              storeId,
              amount:      Number(total),
              source:      'BILLING',
              referenceId: newBill.id,
              createdAt:   createdAt ? new Date(createdAt) : new Date(),
            },
          });

          return newBill;
        });

        saved.push({ localId, billId: created.id });
      } catch (err) {
        console.error(`Bill sync error localId=${bill?.localId}:`, err.message);
        failed.push({ localId: bill?.localId, reason: err.message });
      }
    }

    return NextResponse.json({
      message: 'Sync complete',
      saved, failed, skipped,
      summary: {
        total:   bills.length,
        saved:   saved.length,
        failed:  failed.length,
        skipped: skipped.length,
      },
    });
  } catch (error) {
    console.error('POST /api/store/billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — paginated bill history + today stats
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId, error, status } = await resolveStoreId(request);
    if (!storeId)
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: status || 401 });

    const { searchParams } = new URL(request.url);
    const page        = Math.max(1, parseInt(searchParams.get('page')    || '1'));
    const limit       = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const skip        = (page - 1) * limit;
    const search      = searchParams.get('search')      || '';
    const paymentMode = searchParams.get('paymentMode') || '';
    const dateFrom    = searchParams.get('dateFrom')    || '';
    const dateTo      = searchParams.get('dateTo')      || '';

    const where = {
      storeId,
      ...(search && {
        OR: [
          { billNumber: { contains: search, mode: 'insensitive' } },
          { note:       { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(paymentMode && { paymentMode }),
      ...((dateFrom || dateTo) ? {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo + 'T23:59:59.999Z') }),
        },
      } : {}),
    };

    const [bills, total, stats] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, images: true } },
              variant: { select: { id: true, size: true, price: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
      prisma.bill.aggregate({
        where: { storeId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      bills,
      total,
      page,
      limit,
      totalPages:  Math.ceil(total / limit),
      todayStats:  { count: stats._count.id, revenue: stats._sum.total || 0 },
    });
  } catch (error) {
    console.error('GET /api/store/billing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}