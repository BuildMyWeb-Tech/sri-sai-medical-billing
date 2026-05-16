// app/api/store/billing/route.js

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import {
  verifyEmployeeToken,
  hasPermission,
} from '@/middlewares/authEmployee';

// ─────────────────────────────────────────────
// Resolve Store
// ─────────────────────────────────────────────
async function resolveStoreId(request) {
  try {
    const employee = verifyEmployeeToken(request);

    if (employee?.storeId) {
      if (!hasPermission(employee, 'billing')) {
        return {
          error: 'No billing permission',
          status: 403,
        };
      }

      return {
        storeId: employee.storeId,
        source: 'employee',
      };
    }
  } catch (_) {}

  try {
    const { userId } = getAuth(request);

    if (userId) {
      const storeId = await authSeller(userId);

      if (storeId) {
        return {
          storeId,
          source: 'owner',
        };
      }
    }
  } catch (_) {}

  return {
    error: 'Unauthorized',
    status: 401,
  };
}

// ─────────────────────────────────────────────
// POST BILL
// ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId, error, status } =
      await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: status || 401 }
      );
    }

    const body = await request.json();

    const bills = Array.isArray(body)
      ? body
      : [body];

    const saved = [];
    const failed = [];
    const skipped = [];

    for (const bill of bills) {
      try {
        const {
          localId,
          billNumber,
          subtotal,
          discount = 0,
          taxAmount = 0,
          total,
          paymentMode = 'CASH',
          note,
          items = [],
          createdAt,
          paidAmount,
          changeAmount,
        } = bill;

        // ─────────────────────────
        // Validation
        // ─────────────────────────
        if (
          !billNumber ||
          !items.length ||
          total == null
        ) {
          failed.push({
            localId,
            reason: 'Missing required fields',
          });

          continue;
        }

        // ─────────────────────────
        // Duplicate Prevention
        // ─────────────────────────
        const existing = await prisma.bill.findFirst({
          where: {
            storeId,
            billNumber,
          },
          select: { id: true },
        });

        if (existing) {
          skipped.push({
            localId,
            billId: existing.id,
            reason: 'duplicate',
          });

          continue;
        }

        // ─────────────────────────
        // Transaction
        // ─────────────────────────
        const createdBill = await prisma.$transaction(
          async (tx) => {
            const newBill = await tx.bill.create({
              data: {
                billNumber,
                storeId,

                subtotal: Number(subtotal || 0),
                discount: Number(discount || 0),
                taxAmount: Number(taxAmount || 0),
                total: Number(total || 0),

                paymentMode,
                note: note || null,

                createdAt: createdAt
                  ? new Date(createdAt)
                  : new Date(),

                paidAmount:
                  paidAmount != null
                    ? Number(paidAmount)
                    : null,

                changeAmount:
                  changeAmount != null
                    ? Number(changeAmount)
                    : null,

                items: {
                  create: items.map((item) => ({
                    productId:
                      item.productId || null,

                    variantId:
                      item.variantId || null,

                    // ✅ IMPORTANT FIX
                    batchId:
                      item.batchId || null,

                    name: item.name,

                    size: item.size || null,

                    price: Number(item.price || 0),

                    quantity: Number(
                      item.quantity || 0
                    ),

                    discount: Number(
                      item.discount || 0
                    ),

                    total: Number(item.total || 0),
                  })),
                },
              },
            });

            await tx.sale.create({
              data: {
                storeId,
                amount: Number(total || 0),
                source: 'BILLING',
                referenceId: newBill.id,

                createdAt: createdAt
                  ? new Date(createdAt)
                  : new Date(),
              },
            });

            return newBill;
          },
          {
            timeout: 15000,
          }
        );

        saved.push({
          localId,
          billId: createdBill.id,
        });
      } catch (err) {
        console.error(
          `Billing Sync Error (${bill?.localId}):`,
          err
        );

        failed.push({
          localId: bill?.localId,
          reason: err.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Billing sync complete',
      saved,
      failed,
      skipped,

      summary: {
        total: bills.length,
        saved: saved.length,
        failed: failed.length,
        skipped: skipped.length,
      },
    });
  } catch (error) {
    console.error(
      'POST /api/store/billing error:',
      error
    );

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// GET BILL HISTORY
// ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId, error, status } =
      await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        { error: error || 'Unauthorized' },
        { status: status || 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const page = Math.max(
      1,
      parseInt(searchParams.get('page') || '1')
    );

    const limit = Math.min(
      100,
      parseInt(searchParams.get('limit') || '50')
    );

    const skip = (page - 1) * limit;

    const search =
      searchParams.get('search') || '';

    const where = {
      storeId,

      ...(search && {
        OR: [
          {
            billNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [bills, total] =
      await Promise.all([
        prisma.bill.findMany({
          where,

          include: {
            items: {
              include: {
                product: true,
                variant: true,
                batch: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },

          skip,
          take: limit,
        }),

        prisma.bill.count({ where }),
      ]);

    return NextResponse.json({
      bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(
      'GET /api/store/billing error:',
      error
    );

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}