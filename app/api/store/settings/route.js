// app/api/store/settings/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Store Settings API (STABLE + FIXED AUTH VERSION)
// GET  → Owner + Employee (read-only)
// POST → Owner ONLY
// PUT  → Owner ONLY
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server'; // ✅ FIXED (IMPORTANT)
import { NextResponse } from 'next/server';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import authSeller from '@/middlewares/authSeller';

// ── Admin check ─────────────────────────────────────────────────────────────
async function isAdmin(userId) {
  try {
    const adminIds = (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map((s) => s.trim());
    return adminIds.includes(userId);
  } catch {
    return false;
  }
}

// ── AUTH RESOLVER (FIXED) ───────────────────────────────────────────────────
async function resolveAuth(request) {
  // 1. Employee JWT (billing system)
  try {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) {
      return {
        storeId: emp.storeId,
        source: 'employee',
        userId: null,
        emp,
      };
    }
  } catch (_) {}

  // 2. Clerk Owner (FIXED)
  try {
    const { userId } = getAuth(request); // ✅ CORRECT USAGE

    if (userId) {
      const storeId = await authSeller(userId);

      if (storeId) {
        return {
          storeId,
          source: 'owner',
          userId,
        };
      }

      return {
        storeId: null,
        source: 'clerk',
        userId,
      };
    }
  } catch (_) {}

  return {
    storeId: null,
    source: 'none',
    userId: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId: resolvedStoreId, userId } = await resolveAuth(request);

    const { searchParams } = new URL(request.url);
    const adminStoreId = searchParams.get('storeId');

    let storeId;

    // Admin override
    if (adminStoreId) {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const admin = await isAdmin(userId);
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      storeId = adminStoreId;
    }
    // normal user (owner/employee)
    else if (resolvedStoreId) {
      storeId = resolvedStoreId;
    } else {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let settings = await prisma.storeSettings.findUnique({
      where: { storeId },
    });

    // auto create default settings
    if (!settings) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          address: true,
        },
      });

      if (!store) {
        return NextResponse.json(
          { error: 'Store not found' },
          { status: 404 }
        );
      }

      settings = await prisma.storeSettings.create({
        data: {
          storeId: store.id,
          storeName: store.name,
          address: store.address || '',
          taxType: 'SINGLE',
           taxPercent: 18.0,
    cgst: 9.0,
    sgst: 9.0,
          currency: 'INR',
          showStoreName: true,
          showGST: true,
          footerMessage: 'Thank you for shopping with us!',
          defaultLowStock: 10,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('GET /api/store/settings error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST SETTINGS (OWNER ONLY)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId: resolvedStoreId, source, userId } =
      await resolveAuth(request);

    // block employees
    if (source === 'employee') {
      return NextResponse.json(
        { error: 'Employees cannot update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { storeId: bodyStoreId, ...updateData } = body;

    let storeId;

    if (bodyStoreId) {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const admin = await isAdmin(userId);
      if (!admin) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      storeId = bodyStoreId;
    } else if (resolvedStoreId) {
      storeId = resolvedStoreId;
    } else {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // validate taxType
    if (
      updateData.taxType &&
      !['SINGLE', 'GST_SPLIT'].includes(updateData.taxType)
    ) {
      return NextResponse.json(
        { error: 'Invalid taxType' },
        { status: 400 }
      );
    }

    const numericFields = [
      ['taxPercent', updateData.taxPercent],
      ['cgst', updateData.cgst],
      ['sgst', updateData.sgst],
      ['defaultLowStock', updateData.defaultLowStock],
    ];

    for (const [field, val] of numericFields) {
      if (val !== undefined && (isNaN(Number(val)) || Number(val) < 0)) {
        return NextResponse.json(
          { error: `Invalid value for ${field}` },
          { status: 400 }
        );
      }
    }

    const settings = await prisma.storeSettings.upsert({
      where: { storeId },
      update: updateData,
      create: {
        storeId,
        storeName: updateData.storeName || '',
        address: updateData.address || '',
        ...updateData,
      },
    });

    return NextResponse.json({
      message: 'Settings saved successfully',
      settings,
    });
  } catch (error) {
    console.error('POST /api/store/settings error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT alias
export const PUT = POST;