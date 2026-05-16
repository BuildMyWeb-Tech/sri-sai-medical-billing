// app/api/store/dashboard/route.js
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';

async function resolveStoreId(request) {
  try {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) return emp.storeId;
  } catch (_) {}

  const { userId } = getAuth(request);
  if (!userId) return null;

  return await authSeller(userId);
}

export async function GET(request) {
  try {
    const storeId = await resolveStoreId(request);
    if (!storeId)
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    // ✅ EXPIRY RANGE CALCULATION (NEW - CHANGE 4)
    const now = new Date();
    const in7days = new Date();
    in7days.setDate(now.getDate() + 7);

    const in30days = new Date();
    in30days.setDate(now.getDate() + 30);

    const [
      totalProducts,
      totalOrders,
      totalCategories,
      uniqueCustomers,
      orderStats,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      revenueData,
      ratings,

      // Billing
      billStats,
      todayBillStats,

      // Variants
      topVariantsRaw,
      lowStockVariants,

      // ✅ EXPIRY QUERIES (NEW)
      expiryExpired,
      expiryCritical,
      expirySoon,
    ] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.category.count({ where: { storeId } }),

      prisma.order.groupBy({
        by: ['userId'],
        where: { storeId },
      }),

      prisma.order.aggregate({
        where: { storeId },
        _sum: { total: true },
      }),

      prisma.order.count({ where: { storeId, status: 'ORDER_PLACED' } }),
      prisma.order.count({ where: { storeId, status: 'PROCESSING' } }),
      prisma.order.count({ where: { storeId, status: 'SHIPPED' } }),
      prisma.order.count({ where: { storeId, status: 'DELIVERED' } }),
      prisma.order.count({ where: { storeId, status: 'CANCELLED' } }),

      prisma.$queryRaw`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD MMM') AS date,
          SUM(total) AS revenue,
          COUNT(*) AS orders
        FROM "Order"
        WHERE "storeId" = ${storeId}
          AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Kolkata'),
                 TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'DD MMM')
        ORDER BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') ASC
      `,

      prisma.rating.findMany({
        where: { product: { storeId } },
        include: {
          user: { select: { id: true, name: true, image: true } },
          product: { select: { id: true, name: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Billing total
      prisma.bill.aggregate({
        where: { storeId },
        _sum: { total: true },
        _count: { id: true },
      }),

      // Billing today
      prisma.bill.aggregate({
        where: { storeId, createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: { id: true },
      }),

      // Top variants
      prisma.billItem.groupBy({
        by: ['variantId'],
        where: {
          bill: { storeId },
          variantId: { not: null },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),

      // Low stock variants
      prisma.productVariant.findMany({
        where: {
          stock: { lte: 5 },
          product: { storeId },
        },
        include: {
          product: { select: { id: true, name: true } },
        },
        orderBy: { stock: 'asc' },
        take: 20,
      }),

      // =========================
      // ✅ EXPIRY LOGIC (NEW)
      // =========================

     prisma.productBatch.count({
  where: {
    product: { storeId },
    expiryDate: { not: null, lt: now },  // ← exclude null expiry
    remainingQty: { gt: 0 },
  },
}),

   prisma.productBatch.count({
  where: {
    product: { storeId },
    expiryDate: { not: null, gte: now, lte: in7days },
    remainingQty: { gt: 0 },
  },
}),

prisma.productBatch.count({
  where: {
    product: { storeId },
    expiryDate: { not: null, gte: now, lte: in30days },
    remainingQty: { gt: 0 },
  },
}),
    ]);

    // hydrate variants
    const variantIds = topVariantsRaw.map((r) => r.variantId).filter(Boolean);

    const variantDetails =
      variantIds.length > 0
        ? await prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              size: true,
              product: { select: { name: true } },
            },
          })
        : [];

    const variantMap = Object.fromEntries(
      variantDetails.map((v) => [v.id, v])
    );

    const topVariants = topVariantsRaw.map((r) => {
      const v = variantMap[r.variantId];
      return {
        variantId: r.variantId,
        size: v?.size || '?',
        productName: v?.product?.name || 'Unknown',
        totalQty: r._sum.quantity || 0,
        totalRevenue: r._sum.total || 0,
      };
    });

    const dailyData = (revenueData || []).map((d) => ({
      date: d.date,
      revenue: Number(d.revenue || 0),
      orders: Number(d.orders || 0),
    }));

    return NextResponse.json({
      dashboardData: {
        totalProducts,
        totalOrders,
        totalCategories,
        totalCustomers: uniqueCustomers.length,
        totalEarnings: orderStats._sum.total || 0,
        revenue: orderStats._sum.total || 0,
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        dailyData,
        ratings,

        // billing
        totalBills: billStats._count.id || 0,
        totalBillingRevenue: billStats._sum.total || 0,
        todayBills: todayBillStats._count.id || 0,
        todayBillingRevenue: todayBillStats._sum.total || 0,

        topVariants,
        lowStockVariants: lowStockVariants.map((v) => ({
          variantId: v.id,
          size: v.size,
          stock: v.stock,
          productName: v.product.name,
          productId: v.productId,
        })),

        // ✅ EXPIRY OUTPUT (NEW)
        expiryExpired,
        expiryCritical,
        expirySoon,
      },
    });
  } catch (error) {
    console.error('GET /api/store/dashboard error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}