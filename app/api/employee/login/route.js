// app/api/employee/login/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '@/middlewares/authEmployee';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { email } });

    if (!employee) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!employee.isActive) {
      return NextResponse.json({ error: 'Account is deactivated. Contact your store owner.' }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, employee.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Sign JWT with role + permissions inside
    const token = jwt.sign(
      {
        id: employee.id,
        role: employee.role,
        storeId: employee.storeId,
        permissions: employee.permissions,
        name: employee.name,
        email: employee.email,
      },
      JWT_SECRET_KEY,
      { expiresIn: '7d' }
    );

    const { password: _, ...safeEmployee } = employee;

    return NextResponse.json({
      message: 'Login successful',
      token,
      employee: safeEmployee,
    });
  } catch (error) {
    console.error('POST /api/employee/login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}