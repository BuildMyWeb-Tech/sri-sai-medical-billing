  // app/api/admin/orders/route.js
  // GET /api/admin/orders — admin: fetch ALL orders with filters

  import prisma from '@/lib/prisma';
  import authAdmin from '@/middlewares/authAdmin';
  import { getAuth } from '@clerk/nextjs/server';
  import { NextResponse } from 'next/server';

  export async function GET(request) {
    try {
      const { userId } = getAuth(request);
      const isAdmin = await authAdmin(userId);

      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const statusFilter = searchParams.get('status'); // optional
      const storeIdFilter = searchParams.get('storeId'); // optional
      const dateFrom = searchParams.get('dateFrom'); // optional ISO string
      const dateTo = searchParams.get('dateTo'); // optional ISO string
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '100', 10);

      // ── Build where clause ────────────────────────────────────────
      const where = {};
      if (statusFilter && statusFilter !== 'all') where.status = statusFilter;
      if (storeIdFilter && storeIdFilter !== 'all') where.storeId = storeIdFilter;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            store: { select: { id: true, name: true, username: true, logo: true } },
            address: true,
            orderItems: {
              include: { product: { select: { id: true, name: true, images: true, price: true } } },
            },
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
      console.error('GET /api/admin/orders error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
