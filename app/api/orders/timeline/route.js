// app/api/orders/timeline/route.js
// GET /api/orders/timeline?orderId=xxx  — get full timeline for an order

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import authAdmin from '@/middlewares/authAdmin';

export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    // ── Determine access ──────────────────────────────────────────
    const isAdmin = await authAdmin(userId);
    const storeId = isAdmin ? null : await authSeller(userId);

    if (!isAdmin && !storeId) {
      // Could be a buyer — verify the order belongs to them
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId },
      });
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    } else if (storeId) {
      // Store: verify order belongs to their store
      const order = await prisma.order.findFirst({
        where: { id: orderId, storeId },
      });
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const timeline = await prisma.orderTimeline.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('GET /api/orders/timeline error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
