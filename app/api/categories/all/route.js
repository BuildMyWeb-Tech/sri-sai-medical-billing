// app/api/categories/all/route.js
// PUBLIC endpoint — returns ALL categories (Admin + Store) for the user-facing pages
// No auth required. This is what ProductCategories, CategoriesMarquee, and shop page use.
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { name: true, username: true } } },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('GET /api/categories/all error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
