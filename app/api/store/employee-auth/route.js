// app/api/store/employee-auth/route.js
import prisma from '@/lib/prisma';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Debug: log what header we receive
    const authHeader = request.headers.get('authorization') || '';
    console.log('employee-auth: Authorization header:', authHeader ? 'PRESENT' : 'MISSING');
    console.log('employee-auth: Header value:', authHeader.slice(0, 30) + '...');

    const decoded = verifyEmployeeToken(request);
    console.log('employee-auth: decoded token:', decoded ? 'OK' : 'FAILED');

    if (!decoded) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Re-verify from DB
    const dbEmployee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        storeId: true,
      },
    });

    if (!dbEmployee) {
      return NextResponse.json(
        { valid: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!dbEmployee.isActive) {
      return NextResponse.json(
        { valid: false, error: 'Account has been deactivated' },
        { status: 403 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: dbEmployee.storeId },
    });

    if (!store || store.status !== 'approved') {
      return NextResponse.json(
        { valid: false, error: 'Store not found or not approved' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      employee: dbEmployee,
      store,
    });
  } catch (error) {
    console.error('GET /api/store/employee-auth error:', error);
    return NextResponse.json(
      { valid: false, error: error.message },
      { status: 500 }
    );
  }
}