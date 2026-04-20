// app/api/employee/list/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';

export async function GET(request) {
  try {
    let storeId = null;

    const { userId } = getAuth(request);
    if (userId) storeId = await authSeller(userId);

    if (!storeId) {
      const emp = verifyEmployeeToken(request);
      if (emp && emp.role === 'STORE_OWNER') storeId = emp.storeId;
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const employees = await prisma.employee.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('GET /api/employee/list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
