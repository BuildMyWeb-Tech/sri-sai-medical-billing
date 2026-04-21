import prisma from '@/lib/prisma';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

async function ensureUserExists(userId) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name:
        `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
        'User',
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      image: clerkUser.imageUrl || '',
    },
  });
}

// ─────────────────────────────────────────────
// GET: Fetch user orders
// ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(userId);

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
                category: true,
              },
            },
          },
        },
        address: true,
        store: { select: { name: true, username: true, logo: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// ─────────────────────────────────────────────
// POST: Create order
// ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(userId);

    const body = await request.json();
    const { items, addressId, paymentMethod, couponCode } = body;

    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!addressId) {
      return NextResponse.json(
        { error: 'Delivery address is required' },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // Resolve storeId
    // ─────────────────────────────────────────────
    let storeId = items[0]?.storeId ?? null;

    if (!storeId) {
      const firstProduct = await prisma.product.findUnique({
        where: { id: items[0]?.id },
        select: { storeId: true },
      });

      storeId = firstProduct?.storeId ?? null;
    }

    if (!storeId) {
      return NextResponse.json(
        {
          error:
            'This product is a global catalogue item and cannot be purchased through a store checkout.',
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // Validate store
    // ─────────────────────────────────────────────
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, isActive: true },
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 400 }
      );
    }

    if (!store.isActive) {
      return NextResponse.json(
        { error: 'This store is currently inactive' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // Coupon
    // ─────────────────────────────────────────────
    let couponData = null;
    let discount = 0;
    let isCouponUsed = false;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
      });

      if (coupon && new Date(coupon.expiresAt) > new Date()) {
        couponData = coupon;
        discount = coupon.discount;
        isCouponUsed = true;
      }
    }

    // ─────────────────────────────────────────────
    // Total calculation
    // ─────────────────────────────────────────────
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const total = isCouponUsed
      ? subtotal - (subtotal * discount) / 100
      : subtotal;

    // ─────────────────────────────────────────────
    // Create order (TRANSACTION SAFE)
    // ─────────────────────────────────────────────
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          storeId,
          addressId,
          total,
          paymentMethod,
          isPaid: false,
          isCouponUsed,
          coupon: couponData,
          orderItems: {
            create: items.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: { orderItems: true },
      });

      await tx.orderTimeline.create({
        data: {
          orderId: newOrder.id,
          status: 'ORDER_PLACED',
          changedBy: 'SYSTEM',
          note: 'Order placed successfully',
        },
      });

      // ─────────────────────────────────────────────
      // Stock deduction (SAFE INSIDE TRANSACTION)
      // ─────────────────────────────────────────────
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.id },
          select: { quantity: true, name: true },
        });

        if (!product || product.quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${
              product?.name || item.id
            }". Available: ${product?.quantity ?? 0}, Requested: ${
              item.quantity
            }`
          );
        }

        const newQty = product.quantity - item.quantity;

        await tx.product.update({
          where: { id: item.id },
          data: {
            quantity: newQty,
            inStock: newQty > 0,
          },
        });

        await tx.inventory.upsert({
          where: {
            productId_storeId: {
              productId: item.id,
              storeId,
            },
          },
          update: {
            quantity: newQty,
          },
          create: {
            productId: item.id,
            storeId,
            quantity: newQty,
          },
        });
      }

      return newOrder;
    });

    // ─────────────────────────────────────────────
    // Inngest event
    // ─────────────────────────────────────────────
    try {
      await inngest.send({
        name: 'app/order.created',
        data: { orderId: order.id },
      });
    } catch (err) {
      console.error('Inngest error:', err);
    }

    return NextResponse.json({
      message: 'Order placed successfully',
      order,
    });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}