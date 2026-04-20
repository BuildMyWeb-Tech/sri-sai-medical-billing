// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\app\api\admin\categories\route.js
import imagekit from '@/configs/imageKit';
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// GET all categories (public - used by store owners & users)
export async function GET(request) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Admin creates a new category
export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const isAdmin = await authAdmin(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const imageFile = formData.get('image');

    if (!name || !description || !imageFile) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Check if category already exists
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }

    // Upload image to ImageKit
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: imageFile.name,
      folder: 'categories',
    });

    const imageUrl = imagekit.url({
      path: uploadResponse.filePath,
      transformation: [{ quality: 'auto' }, { format: 'webp' }, { width: '512' }],
    });

    const category = await prisma.category.create({
      data: { name, description, image: imageUrl },
    });

    return NextResponse.json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Admin deletes a category
export async function DELETE(request) {
  try {
    const { userId } = getAuth(request);
    const isAdmin = await authAdmin(userId);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
