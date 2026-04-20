// app/api/cart/route.js
import prisma from '@/lib/prisma';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

// ── POST — save cart to DB ────────────────────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserExists(userId);

    const body = await request.json();
    const cart = body.cart ?? body.items ?? [];

    await prisma.user.update({
      where: { id: userId },
      data: { cart },
    });

    return NextResponse.json({ message: 'Cart saved' });
  } catch (error) {
    console.error('POST /api/cart error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// ── GET — fetch cart with live stock validation ───────────────────
// Returns each item with:
//   - availableStock: current stock from DB
//   - stockWarning: true if cart quantity > available stock
//   - outOfStock: true if product has 0 stock
export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureUserExists(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const cartData = user?.cart ?? [];
    const rawItems = Array.isArray(cartData) ? cartData : (cartData.items ?? []);

    if (rawItems.length === 0) {
      return NextResponse.json({ items: [], totalPrice: 0 });
    }

    // Fetch current stock for all cart product IDs in one query
    const productIds = rawItems.map((item) => item.id).filter(Boolean);
    const liveProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, quantity: true, inStock: true, price: true, name: true },
    });

    const stockMap = {};
    liveProducts.forEach((p) => {
      stockMap[p.id] = p;
    });

    // Enrich cart items with live stock data
    const items = rawItems.map((item) => {
      const live = stockMap[item.id];
      const availableStock = live?.quantity ?? 0;
      const outOfStock = availableStock === 0;
      // Cap quantity at available stock if overshooting
      const safeQuantity = outOfStock ? 0 : Math.min(item.quantity, availableStock);
      const stockWarning = item.quantity > availableStock;

      return {
        ...item,
        quantity: safeQuantity,
        availableStock,
        outOfStock,
        stockWarning,
      };
    });

    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return NextResponse.json({ items, totalPrice });
  } catch (error) {
    console.error('GET /api/cart error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
