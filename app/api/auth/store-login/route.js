// app/api/auth/store-login/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'employee_jwt_secret_kingcart_2024';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ── STEP 1: Check Employee table first ────────────────────────
    const employee = await prisma.employee.findUnique({ where: { email } });

    if (employee) {
      // Validate password
      const isValid = await bcrypt.compare(password, employee.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Check if active
      if (!employee.isActive) {
        return NextResponse.json(
          { error: 'Your account has been deactivated. Contact your store owner.' },
          { status: 403 }
        );
      }

      // Get store info to verify it's approved
      const store = await prisma.store.findUnique({
        where: { id: employee.storeId },
      });

      if (!store || store.status !== 'approved') {
        return NextResponse.json(
          { error: 'Store is not active or approved yet.' },
          { status: 403 }
        );
      }

      // Generate JWT with full permissions payload
      const token = jwt.sign(
        {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role, // EMPLOYEE or STORE_OWNER
          storeId: employee.storeId,
          permissions: employee.permissions,
          type: 'employee',
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return NextResponse.json({
        message: 'Login successful',
        token,
        user: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          storeId: employee.storeId,
          permissions: employee.permissions,
          type: 'employee',
          storeName: store.name,
          storeLogo: store.logo,
        },
      });
    }

    // ── STEP 2: Check Store Owner table ───────────────────────────
    // Store owners are in the Store model — find by store email
    const store = await prisma.store.findFirst({
      where: { email },
      include: { user: true },
    });

    if (store) {
      // Store owners don't have a password in Store model — they use Clerk
      // But per the new requirement, we need to support password login
      // Check if there's a STORE_OWNER employee record for them
      const ownerEmployee = await prisma.employee.findFirst({
        where: { email, role: 'STORE_OWNER' },
      });

      if (ownerEmployee) {
        const isValid = await bcrypt.compare(password, ownerEmployee.password);
        if (!isValid) {
          return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (store.status !== 'approved') {
          return NextResponse.json(
            {
              error:
                store.status === 'pending'
                  ? 'Your store is waiting for admin approval.'
                  : 'Your store has been rejected. Contact admin.',
            },
            { status: 403 }
          );
        }

        const token = jwt.sign(
          {
            id: ownerEmployee.id,
            name: ownerEmployee.name,
            email: ownerEmployee.email,
            role: 'STORE_OWNER',
            storeId: store.id,
            permissions: {},
            type: 'employee',
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return NextResponse.json({
          message: 'Login successful',
          token,
          user: {
            id: ownerEmployee.id,
            name: ownerEmployee.name,
            email: ownerEmployee.email,
            role: 'STORE_OWNER',
            storeId: store.id,
            permissions: {},
            type: 'employee',
            storeName: store.name,
            storeLogo: store.logo,
          },
        });
      }

      // Store is pending/rejected — give proper message
      if (store.status === 'pending') {
        return NextResponse.json(
          { error: 'Your store is waiting for admin approval.' },
          { status: 403 }
        );
      }
      if (store.status === 'rejected') {
        return NextResponse.json(
          { error: 'Your store has been rejected. Please contact admin.' },
          { status: 403 }
        );
      }
    }

    // Nothing matched
    return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
  } catch (error) {
    console.error('POST /api/auth/store-login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
