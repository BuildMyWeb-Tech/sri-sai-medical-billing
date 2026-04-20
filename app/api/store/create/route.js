// app/api/store/create/route.js
import imagekit from '@/configs/imageKit';
import prisma from '@/lib/prisma';
import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

async function ensureUserExists(userId) {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      image: clerkUser.imageUrl || '',
    },
  });
}

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await ensureUserExists(userId);

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const username = formData.get('username');
    const address = formData.get('address');
    const email = formData.get('email');
    const contact = formData.get('contact');
    const logoFile = formData.get('image') || formData.get('logo');

    if (!name || !description || !username || !address || !email || !contact || !logoFile) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const usernameTaken = await prisma.store.findUnique({ where: { username } });
    if (usernameTaken) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    const existingStore = await prisma.store.findUnique({ where: { userId } });
    if (existingStore) {
      return NextResponse.json({ error: 'You already have a store' }, { status: 400 });
    }

    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: logoFile.name,
      folder: 'stores',
    });

    const logo = imagekit.url({
      path: uploadResponse.filePath,
      transformation: [{ quality: 'auto' }, { format: 'webp' }, { width: '256' }],
    });

    // Create store and auto-create default settings in a transaction
    const { store: newStore } = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          userId,
          name,
          description,
          username,
          address,
          email,
          contact,
          logo,
          status: 'pending',
          isActive: false,
        },
      });

      // Auto-create default StoreSettings
      await tx.storeSettings.create({
        data: {
          storeId: store.id,
          storeName: store.name,
          address: store.address,
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

      return { store };
    });

    return NextResponse.json({
      message: 'Store created successfully. Awaiting admin approval.',
      store: newStore,
    });
  } catch (error) {
    console.error('POST /api/store/create error:', error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}

export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const store = await prisma.store.findUnique({ where: { userId } });

    if (!store) return NextResponse.json({ store: null, status: null });

    return NextResponse.json({ store, status: store.status });
  } catch (error) {
    console.error('GET /api/store/create error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
