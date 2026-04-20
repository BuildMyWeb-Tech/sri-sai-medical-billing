// app/api/employee/delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';

export async function DELETE(request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    const existing = await prisma.employee.findFirst({ where: { id, storeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.employee.delete({ where: { id } });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/employee/delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
