// app/api/employee/update/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';

export async function PUT(request) {
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

    const body = await request.json();
    const { id, name, email, password, role, permissions, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    // Make sure employee belongs to this store
    const existing = await prisma.employee.findFirst({ where: { id, storeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ message: 'Employee updated', employee: updated });
  } catch (error) {
    console.error('PUT /api/employee/update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
