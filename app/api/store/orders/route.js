// app/api/store/orders/route.js
import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const STORE_ALLOWED_TRANSITIONS = {
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const PRE_SHIPPED_STATUSES = new Set(['ORDER_PLACED', 'CONFIRMED', 'PROCESSING']);

// ── Helper: resolve storeId from employee JWT or Clerk ────────────
async function resolveStoreId(request) {
  const emp = verifyEmployeeToken(request);
  if (emp?.storeId) return emp.storeId;

  const { userId } = getAuth(request);
  if (!userId) return null;
  return authSeller(userId);
}

// ── Helper: restore inventory on cancel/return ────────────────────
// FIX: Now updates BOTH Product table AND Inventory table
async function restoreInventory(tx, orderId) {
  // Get order storeId + all items in one query
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      storeId: true,
      orderItems: {
        select: { productId: true, quantity: true },
      },
    },
  });

  if (!order) return;

  for (const item of order.orderItems) {
    // 1. Get current product quantity
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { quantity: true },
    });

    if (!product) continue;

    const newQty = product.quantity + item.quantity;

    // 2. Update Product table → Manage Products page reads this ✅
    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: newQty, inStock: newQty > 0 },
    });

    // 3. Update Inventory table → Inventory page reads this ✅
    //    Use findFirst + update by id (safer than updateMany)
    const invRecord = await tx.inventory.findFirst({
      where: {
        productId: item.productId,
        storeId: order.storeId,
      },
      select: { id: true },
    });

    if (invRecord) {
      await tx.inventory.update({
        where: { id: invRecord.id },
        data: { quantity: newQty },
      });
    } else {
      // Safety net: create inventory record if missing
      await tx.inventory.create({
        data: {
          productId: item.productId,
          storeId: order.storeId,
          quantity: newQty,
          lowStock: 10,
        },
      });
    }
  }
}

// ── POST: update order status ─────────────────────────────────────
export async function POST(request) {
  try {
    const storeId = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { orderId, status, note } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: { id: true, status: true, storeId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 });
    }

    const currentStatus = order.status;
    const allowed = STORE_ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${status}. Allowed: ${
            allowed.join(', ') || 'none'
          }`,
        },
        { status: 400 }
      );
    }

    if (status === 'CANCELLED' && !PRE_SHIPPED_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        { error: 'Orders can only be cancelled before they are shipped' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderTimeline.create({
        data: {
          orderId,
          status,
          changedBy: 'STORE',
          note: note || null,
        },
      });

      // Restore stock in BOTH Product + Inventory tables on cancel/return
      if (status === 'CANCELLED' || status === 'RETURNED') {
        await restoreInventory(tx, orderId);
      }
    });

    return NextResponse.json({
      message: 'Order status updated',
      inventoryRestored: ['CANCELLED', 'RETURNED'].includes(status),
    });
  } catch (error) {
    console.error('POST /api/store/orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// ── GET: fetch all orders for this store ──────────────────────────
export async function GET(request) {
  try {
    const storeId = await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where = { storeId };

    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: true,
          address: true,
          orderItems: { include: { product: true } },
          timeline: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error('GET /api/store/orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
