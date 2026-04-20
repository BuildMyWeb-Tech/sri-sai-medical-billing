// app/api/store/settings/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Replaces /api/settings
// GET  → Store owner + Employee (read-only for billing)
// POST → Store owner ONLY
// PUT  → Store owner ONLY (same logic as POST, alias)
// ─────────────────────────────────────────────────────────────────────────────
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import authSeller from '@/middlewares/authSeller';

// ── Check if userId is an admin ───────────────────────────────────────────────
async function isAdmin(userId) {
  try {
    const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim());
    return adminIds.includes(userId);
  } catch {
    return false;
  }
}

// ── Resolve storeId + role from any auth source ───────────────────────────────
// Priority: Employee JWT → Clerk store owner
async function resolveAuth(request) {
  // 1. Employee JWT
  try {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) {
      return { storeId: emp.storeId, source: 'employee', emp };
    }
  } catch (_) {}

  // 2. Clerk session (store owner)
  try {
    const { userId } = getAuth(request);
    if (userId) {
      const storeId = await authSeller(userId);
      if (storeId) return { storeId, source: 'owner', userId };
      // Clerk user but not a seller — check admin
      return { storeId: null, source: 'clerk', userId };
    }
  } catch (_) {}

  return { storeId: null, source: 'none' };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/store/settings
// Allowed: Store owner, Employee (billing read), Admin (with ?storeId=)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId: resolvedStoreId, source, userId } = await resolveAuth(request);

    const { searchParams } = new URL(request.url);
    const adminStoreId = searchParams.get('storeId');

    let storeId;

    if (adminStoreId) {
      // Admin fetching settings for a specific store
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const admin = await isAdmin(userId);
      if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      storeId = adminStoreId;
    } else if (resolvedStoreId) {
      storeId = resolvedStoreId;
    } else {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch settings, auto-create if missing
    let settings = await prisma.storeSettings.findUnique({ where: { storeId } });

    if (!settings) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, address: true },
      });
      if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

      settings = await prisma.storeSettings.create({
        data: {
          storeId: store.id,
          storeName: store.name,
          address: store.address || '',
          taxType: 'SINGLE',
          taxPercent: 18,
          cgst: 9,
          sgst: 9,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/store/settings
// Allowed: Store owner ONLY
// Employees are BLOCKED (403)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId: resolvedStoreId, source, userId, emp } = await resolveAuth(request);

    // Block employees from updating settings
    if (source === 'employee') {
      return NextResponse.json(
        { error: 'Employees cannot update store settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { storeId: bodyStoreId, ...updateData } = body;

    let storeId;

    if (bodyStoreId) {
      // Admin updating settings for a specific store
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const admin = await isAdmin(userId);
      if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      storeId = bodyStoreId;
    } else if (resolvedStoreId) {
      storeId = resolvedStoreId;
    } else {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate taxType
    if (updateData.taxType && !['SINGLE', 'GST_SPLIT'].includes(updateData.taxType)) {
      return NextResponse.json({ error: 'Invalid taxType' }, { status: 400 });
    }

    // Validate numeric fields
    const numericFields = [
      ['taxPercent', updateData.taxPercent],
      ['cgst', updateData.cgst],
      ['sgst', updateData.sgst],
      ['defaultLowStock', updateData.defaultLowStock],
    ];
    for (const [field, val] of numericFields) {
      if (val !== undefined && (isNaN(Number(val)) || Number(val) < 0)) {
        return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 });
      }
    }

    // Upsert settings
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

    return NextResponse.json({ message: 'Settings saved successfully', settings });
  } catch (error) {
    console.error('POST /api/store/settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT is identical to POST — alias for REST completeness
export const PUT = POST;