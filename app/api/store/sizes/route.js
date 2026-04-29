import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

// GET — fetch all global sizes for this store
export async function GET(req) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const store = await prisma.store.findUnique({ where: { userId } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    const sizes = await prisma.storeSize.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ sizes: sizes.map((s) => s.label) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — save a new global size
export async function POST(req) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { label } = await req.json();
    if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 });

    const store = await prisma.store.findUnique({ where: { userId } });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    await prisma.storeSize.upsert({
      where: { storeId_label: { storeId: store.id, label: label.trim() } },
      update: {},
      create: { storeId: store.id, label: label.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}