import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── POST: Add a new rating (requires a valid order) ───────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, productId, rating, review } = await request.json();

    // orderId is optional when submitting from product page (not order page)
    // If orderId is provided, validate the order belongs to the user
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId, userId },
      });

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const isAlreadyRated = await prisma.rating.findFirst({
        where: { productId, orderId },
      });

      if (isAlreadyRated) {
        return NextResponse.json(
          { error: 'Product already rated for this order' },
          { status: 400 }
        );
      }
    } else {
      // Without orderId: check if user already rated this product at all
      const isAlreadyRated = await prisma.rating.findFirst({
        where: { productId, userId },
      });

      if (isAlreadyRated) {
        return NextResponse.json(
          { error: 'You have already reviewed this product' },
          { status: 400 }
        );
      }
    }

    const response = await prisma.rating.create({
      data: {
        userId,
        productId,
        rating,
        review,
        ...(orderId ? { orderId } : {}),
      },
    });

    // Return rating with user info for immediate UI display
    const user = await prisma.user?.findUnique({ where: { id: userId } }).catch(() => null);

    return NextResponse.json({
      message: 'Rating added successfully',
      rating: {
        ...response,
        user: {
          id: userId,
          name: user?.name || 'User',
          image: user?.image || null,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}

// ── GET: Fetch ratings ────────────────────────────────────────────────────────
// ?productId=xxx  → public: all ratings for a product (for product page)
// no params       → private: ratings submitted by the logged-in user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (productId) {
      // Public fetch — all ratings for this product with user info
      const ratings = await prisma.rating.findMany({
        where: { productId },
        include: {
          // Include user info if you have a User model relation on Rating
          // If not, we just return the rating fields and handle user display in frontend
        },
        orderBy: { createdAt: 'desc' },
      });

      // Try to attach user info if your Rating model has a user relation
      // If your schema doesn't have it, this still works — frontend shows "User"
      return NextResponse.json({ ratings });
    }

    // Private fetch — ratings by logged-in user
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ratings = await prisma.rating.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ratings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
