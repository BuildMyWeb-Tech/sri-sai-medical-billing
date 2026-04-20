// app/api/orders/route.js
import prisma from '@/lib/prisma';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { inngest } from '@/inngest/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function ensureUserExists(userId) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      image: clerkUser.imageUrl || '',
    },
  });
}

// ── GET: fetch all orders for the logged-in buyer ─────────────────
export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserExists(userId);

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        orderItems: {
          include: {
            product: {
              select: { id: true, name: true, images: true, price: true, category: true },
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

// ── POST: create a new order ──────────────────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserExists(userId);

    const body = await request.json();
    const { items, addressId, paymentMethod, couponCode } = body;

    if (!items || items.length === 0)
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    if (!addressId)
      return NextResponse.json({ error: 'Delivery address is required' }, { status: 400 });
    if (!paymentMethod)
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });

    // ── Resolve storeId ───────────────────────────────────────────
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
        { error: 'This product is a global catalogue item and cannot be purchased through a store checkout.' },
        { status: 400 }
      );
    }

    // ── Validate all items belong to same store ───────────────────
    for (const item of items) {
      const itemStoreId = item.storeId ?? null;
      if (itemStoreId && itemStoreId !== storeId) {
        return NextResponse.json(
          { error: 'Your cart contains products from multiple stores. Please purchase from one store at a time.' },
          { status: 400 }
        );
      }
    }

    // ── Validate store exists and is active ───────────────────────
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, isActive: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 400 });
    if (!store.isActive)
      return NextResponse.json({ error: 'This store is currently inactive' }, { status: 400 });

    // ── PRE-ORDER STOCK VALIDATION ────────────────────────────────
    // Fetch live stock for all items in one query — prevents overselling
    const productIds = items.map((item) => item.id);
    const liveProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, quantity: true, inStock: true },
    });

    const stockMap = {};
    liveProducts.forEach((p) => { stockMap[p.id] = p; });

    const stockErrors = [];
    for (const item of items) {
      const live = stockMap[item.id];
      if (!live) {
        stockErrors.push(`Product "${item.name || item.id}" not found`);
        continue;
      }
      if (!live.inStock || live.quantity < item.quantity) {
        if (live.quantity === 0) {
          stockErrors.push(`"${live.name}" is out of stock`);
        } else {
          stockErrors.push(
            `"${live.name}" only has ${live.quantity} in stock, but you requested ${item.quantity}`
          );
        }
      }
    }

    if (stockErrors.length > 0) {
      return NextResponse.json(
        { error: stockErrors.join('. ') },
        { status: 400 }
      );
    }
    // ── END STOCK VALIDATION ──────────────────────────────────────

    // ── Resolve coupon ────────────────────────────────────────────
    let couponData = {};
    let isCouponUsed = false;
    let discount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (coupon && new Date(coupon.expiresAt) > new Date()) {
        couponData = coupon;
        isCouponUsed = true;
        discount = coupon.discount;
      }
    }

    // ── Calculate total ───────────────────────────────────────────
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = isCouponUsed ? subtotal - (subtotal * discount) / 100 : subtotal;

    // ── Create order + deduct stock atomically ────────────────────
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

      // ── Log initial timeline entry ────────────────────────────
      await tx.orderTimeline.create({
        data: {
          orderId: newOrder.id,
          status: 'ORDER_PLACED',
          changedBy: 'SYSTEM',
          note: 'Order placed successfully',
        },
      });

      // ── Deduct inventory atomically ───────────────────────────
      // Re-check inside transaction to handle concurrent orders
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.id },
          select: { quantity: true, name: true },
        });

        if (!product || product.quantity < item.quantity) {
          // Throw to rollback the entire transaction
          throw new Error(
            `Insufficient stock for "${product?.name || item.id}". ` +
            `Available: ${product?.quantity ?? 0}, Requested: ${item.quantity}`
          );
        }

        const newQty = product.quantity - item.quantity;

        // Update product quantity + inStock flag
        await tx.product.update({
          where: { id: item.id },
          data: { quantity: newQty, inStock: newQty > 0 },
        });

        // Keep Inventory table in sync
        await tx.inventory.updateMany({
          where: { productId: item.id, storeId },
          data: { quantity: newQty },
        });
      }

      return newOrder;
    });

    // ── Trigger Inngest to create Sale record ─────────────────────
    await inngest.send({ name: 'app/order.created', data: { orderId: order.id } });

    // ── Stripe checkout ───────────────────────────────────────────
    if (paymentMethod === 'STRIPE') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item) => ({
          price_data: {
            currency: 'inr',
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
        metadata: { orderId: order.id },
      });
      return NextResponse.json({ message: 'Order placed successfully', order, session });
    }

    return NextResponse.json({ message: 'Order placed successfully', order });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}