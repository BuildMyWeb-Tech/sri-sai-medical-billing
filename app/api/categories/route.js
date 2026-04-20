// app/api/categories/route.js
import imagekit from '@/configs/imageKit';
import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Resolve caller role ───────────────────────────────────────────
async function resolveRole(request) {
  const { userId } = getAuth(request);
  if (!userId) return { userId: null, role: null, storeId: null };

  const isAdmin = await authAdmin(userId);
  if (isAdmin) return { userId, role: 'ADMIN', storeId: null };

  const storeId = await authSeller(userId);
  if (storeId) return { userId, role: 'STORE', storeId };

  return { userId, role: null, storeId: null };
}

// ── GET: Scoped fetch ─────────────────────────────────────────────
// Admin  → all categories (global + all stores)
// Store  → global (ADMIN) + their own
// Public → global only
//
// ── Also handles dependency check before delete ───────────────────
// ?checkOnly=true&id=<categoryId>
// Returns: { categoryName, affectedCount, affectedProducts[] }
export async function GET(request) {
  try {
    const { role, storeId } = await resolveRole(request);
    const { searchParams } = new URL(request.url);

    // ── Dependency check mode ─────────────────────────────────────
    const checkOnly = searchParams.get('checkOnly') === 'true';
    const checkId = searchParams.get('id');

    if (checkOnly && checkId) {
      // Must be authenticated to check
      if (!role) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }

      const category = await prisma.category.findUnique({ where: { id: checkId } });
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      // Find all products that include this category name in their array
      const affectedProducts = await prisma.product.findMany({
        where: { category: { has: category.name } },
        select: { id: true, name: true, createdBy: true, storeId: true },
      });

      return NextResponse.json({
        categoryName: category.name,
        affectedCount: affectedProducts.length,
        affectedProducts: affectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          scope: p.createdBy === 'ADMIN' ? 'Global' : 'Store',
        })),
      });
    }

    // ── Normal list fetch ─────────────────────────────────────────
    let where = {};

    if (role === 'ADMIN') {
      where = {};
    } else if (role === 'STORE') {
      where = { OR: [{ createdBy: 'ADMIN' }, { storeId }] };
    } else {
      // Public: global only
      where = { createdBy: 'ADMIN' };
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { name: true, username: true } } },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Create category ─────────────────────────────────────────
// Admin  → global (storeId = null, createdBy = ADMIN)
// Store  → scoped (storeId = store's id, createdBy = STORE)
export async function POST(request) {
  try {
    const { role, storeId } = await resolveRole(request);

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const imageFile = formData.get('image');

    if (!name || !description || !imageFile) {
      return NextResponse.json(
        { error: 'Name, description and image are required' },
        { status: 400 }
      );
    }

    const scopedStoreId = role === 'ADMIN' ? null : storeId;

    const existing = await prisma.category.findFirst({
      where: { name, storeId: scopedStoreId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists in this scope' },
        { status: 400 }
      );
    }

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
      data: {
        name,
        description,
        image: imageUrl,
        createdBy: role,
        storeId: scopedStoreId,
      },
      include: { store: { select: { name: true, username: true } } },
    });

    return NextResponse.json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('POST /api/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Edit category ────────────────────────────────────────────
// Admin  → can edit any category
// Store  → can only edit their own categories
export async function PUT(request) {
  try {
    const { role, storeId } = await resolveRole(request);

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const id = formData.get('id');
    const name = formData.get('name');
    const description = formData.get('description');
    const imageFile = formData.get('image');

    if (!id || !name || !description) {
      return NextResponse.json({ error: 'ID, name and description are required' }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only edit your own categories' }, { status: 403 });
    }

    const nameConflict = await prisma.category.findFirst({
      where: { name, storeId: existing.storeId, NOT: { id } },
    });
    if (nameConflict) {
      return NextResponse.json(
        { error: 'Another category with this name already exists' },
        { status: 400 }
      );
    }

    let imageUrl = existing.image;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const uploadResponse = await imagekit.upload({
        file: buffer,
        fileName: imageFile.name,
        folder: 'categories',
      });
      imageUrl = imagekit.url({
        path: uploadResponse.filePath,
        transformation: [{ quality: 'auto' }, { format: 'webp' }, { width: '512' }],
      });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name, description, image: imageUrl },
      include: { store: { select: { name: true, username: true } } },
    });

    return NextResponse.json({ message: 'Category updated successfully', category: updated });
  } catch (error) {
    console.error('PUT /api/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete category ───────────────────────────────────────
// Body: { id: string, deleteProducts?: boolean }
//
// deleteProducts = true  → delete all products using this category, then delete category
// deleteProducts = false → remove category name from products' array,  then delete category
export async function DELETE(request) {
  try {
    const { role, storeId } = await resolveRole(request);

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, deleteProducts = false } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json(
        { error: 'You can only delete your own categories' },
        { status: 403 }
      );
    }

    // ── Find products that use this category ──────────────────────
    const affectedProducts = await prisma.product.findMany({
      where: { category: { has: existing.name } },
      select: { id: true, category: true },
    });

    if (deleteProducts) {
      // ── Option A: delete the products entirely ────────────────
      await prisma.product.deleteMany({
        where: { category: { has: existing.name } },
      });
    } else {
      // ── Option B: strip the category name from each product ───
      await Promise.all(
        affectedProducts.map((product) =>
          prisma.product.update({
            where: { id: product.id },
            data: {
              category: product.category.filter((c) => c !== existing.name),
            },
          })
        )
      );
    }

    // Delete the category itself
    await prisma.category.delete({ where: { id } });

    return NextResponse.json({
      message: deleteProducts
        ? `Category and ${affectedProducts.length} product(s) deleted successfully`
        : `Category deleted. ${affectedProducts.length} product(s) updated`,
      deletedProducts: deleteProducts ? affectedProducts.length : 0,
      updatedProducts: deleteProducts ? 0 : affectedProducts.length,
    });
  } catch (error) {
    console.error('DELETE /api/categories error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
