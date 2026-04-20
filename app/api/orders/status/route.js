// app/api/orders/status/route.js
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import authAdmin from '@/middlewares/authAdmin';

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

const ADMIN_ALLOWED_TRANSITIONS = {
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED', 'PROCESSING', 'SHIPPED', 'DELIVERED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'],
  RETURN_REQUESTED: ['RETURNED', 'REFUNDED', 'DELIVERED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: ['ORDER_PLACED'],
  REFUNDED: [],
};

const PRE_SHIPPED_STATUSES = new Set(['ORDER_PLACED', 'CONFIRMED', 'PROCESSING']);

// ── Helper: restore inventory on cancel / return ──────────────────
async function restoreInventory(tx, orderId) {
  // Step 1: Get order with storeId + all order items
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
    // Step 2: Get product with its own storeId too (fallback)
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { quantity: true, storeId: true },
    });

    if (!product) continue;

    const newQty = product.quantity + item.quantity;

    // Step 3: Update Product table (Manage Products page reads this)
    await tx.product.update({
      where: { id: item.productId },
      data: { quantity: newQty, inStock: newQty > 0 },
    });

    // Step 4: Find the actual inventory record to get the correct storeId
    // We try order.storeId first, then fall back to product.storeId
    const storeId = order.storeId || product.storeId;
    if (!storeId) continue;

    // Step 5: Check if inventory record exists
    const existingInv = await tx.inventory.findFirst({
      where: {
        productId: item.productId,
        storeId: storeId,
      },
      select: { id: true },
    });

    if (existingInv) {
      // Update existing inventory record
      await tx.inventory.update({
        where: { id: existingInv.id },
        data: { quantity: newQty },
      });
    } else {
      // Inventory record missing — create it so page is never stale
      await tx.inventory.create({
        data: {
          productId: item.productId,
          storeId: storeId,
          quantity: newQty,
          lowStock: 10,
        },
      });
    }
  }
}

// ── PUT: update order status ──────────────────────────────────────
export async function PUT(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { orderId, newStatus, note } = body;

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'orderId and newStatus are required' }, { status: 400 });
    }

    // ── Determine role ────────────────────────────────────────────
    let role = null;
    let storeId = null;

    const isAdmin = await authAdmin(userId);
    if (isAdmin) {
      role = 'ADMIN';
    } else {
      storeId = await authSeller(userId);
      if (storeId) role = 'STORE';
    }

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // ── Fetch existing order ──────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, storeId: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Store can only update its own orders
    if (role === 'STORE' && order.storeId !== storeId) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    const currentStatus = order.status;
    const allowedMap = role === 'ADMIN' ? ADMIN_ALLOWED_TRANSITIONS : STORE_ALLOWED_TRANSITIONS;
    const allowed = allowedMap[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${
            allowed.join(', ') || 'none'
          }`,
        },
        { status: 400 }
      );
    }

    // Only allow cancel before shipped
    if (newStatus === 'CANCELLED' && !PRE_SHIPPED_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        { error: 'Orders can only be cancelled before they are shipped' },
        { status: 400 }
      );
    }

    // ── Transaction: update status + timeline + restore inventory ─
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      // 2. Log timeline entry
      await tx.orderTimeline.create({
        data: {
          orderId,
          status: newStatus,
          changedBy: role,
          note: note || null,
        },
      });

      // 3. Restore stock in BOTH Product + Inventory tables
      if (newStatus === 'CANCELLED' || newStatus === 'RETURNED') {
        await restoreInventory(tx, orderId);
      }

      return updated;
    });

    return NextResponse.json({
      message: `Order status updated to ${newStatus}`,
      order: updatedOrder,
      inventoryRestored: ['CANCELLED', 'RETURNED'].includes(newStatus),
    });
  } catch (error) {
    console.error('PUT /api/orders/status error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// ── GET: get allowed next statuses for an order ───────────────────
export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const isAdmin = await authAdmin(userId);
    const storeId = isAdmin ? null : await authSeller(userId);
    const role = isAdmin ? 'ADMIN' : storeId ? 'STORE' : null;

    if (!role) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const allowedMap = role === 'ADMIN' ? ADMIN_ALLOWED_TRANSITIONS : STORE_ALLOWED_TRANSITIONS;
    const allowed = allowedMap[order.status] || [];

    return NextResponse.json({ currentStatus: order.status, allowedTransitions: allowed });
  } catch (error) {
    console.error('GET /api/orders/status error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
