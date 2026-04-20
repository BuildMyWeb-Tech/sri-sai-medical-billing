// app/api/employee/create/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';

export async function POST(request) {
  try {
    // Allow Clerk store owners OR employee JWT with STORE_OWNER role
    let storeId = null;
    let actorRole = null;

    const { userId } = getAuth(request);
    if (userId) {
      storeId = await authSeller(userId);
      actorRole = 'STORE_OWNER';
    }

    if (!storeId) {
      const emp = verifyEmployeeToken(request);
      if (emp && emp.role === 'STORE_OWNER') {
        storeId = emp.storeId;
        actorRole = 'STORE_OWNER';
      }
    }

    // Allow ADMIN (Clerk admin check)
    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, password, role = 'EMPLOYEE', permissions = {} } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        password: hashedPassword,
        storeId,
        role,
        permissions,
        isActive: true,
      },
    });

    const { password: _, ...safeEmployee } = employee;
    return NextResponse.json(
      { message: 'Employee created successfully', employee: safeEmployee },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/employee/create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
