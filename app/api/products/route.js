// app/api/products/route.js

import prisma from '@/lib/prisma';
import authAdmin from '@/middlewares/authAdmin';
import authSeller from '@/middlewares/authSeller';
import imagekit from '@/configs/imageKit';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Resolve role ──────────────────────────────────────────────────
async function resolveRole(request) {
  const { userId } = getAuth(request);
  if (!userId) return { userId: null, role: null, storeId: null };

  const isAdmin = await authAdmin(userId);
  if (isAdmin) return { userId, role: 'ADMIN', storeId: null };

  const storeId = await authSeller(userId);
  if (storeId) return { userId, role: 'STORE', storeId };

  return { userId, role: null, storeId: null };
}

// ── UPDATED VALIDATION ────────────────────────────────────────────
function validateProductFields(fields) {
  const missing = [];
  if (!fields.name) missing.push('Name');
  if (!fields.variants || fields.variants.length === 0) {
    missing.push('At least one variant');
  }
  return missing;
}

// ── GET ───────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { role, storeId } = await resolveRole(request);
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const filterStoreId = searchParams.get('storeId');
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '50'));

    let where = {};

    if (role === 'ADMIN') {
      where = {};
    } else if (role === 'STORE') {
      where = { OR: [{ createdBy: 'ADMIN' }, { storeId }] };
    } else {
      where = { inStock: true };
    }

    if (category) where.category = { has: category };

    if (search) {
      const q = search.trim();

      const searchCondition = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { variants: { some: { barcode: { contains: q, mode: 'insensitive' } } } },
        ],
      };

      if (where.OR) {
        where = { AND: [{ OR: where.OR }, searchCondition] };
      } else {
        Object.assign(where, searchCondition);
      }
    }

    if (filterStoreId) where.storeId = filterStoreId;

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        mrp: true,
        images: true,
        category: true,
        quantity: true,
        inStock: true,
        storeId: true,
        sku: true,
        createdBy: true,
        createdAt: true,
        variants: {
          select: {
            id: true,
            size: true,
            price: true,
            stock: true,
            barcode: true,
          },
        },
        rating: {
          select: {
            id: true,
            rating: true,
            review: true,
            userId: true,
            createdAt: true,
          },
        },
        store: {
          select: {
            name: true,
            username: true,
            logo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const productsWithBadge = products.map((p) => ({
      ...p,
      badge: p.createdBy === 'ADMIN' ? 'Global' : 'Store',
    }));

    return NextResponse.json({ products: productsWithBadge });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { role } = await resolveRole(request);

    if (role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create global products via this endpoint.' },
        { status: 403 }
      );
    }

    // ── REPLACED FORM PARSING BLOCK ───────────────────────────────
    const formData = await request.formData();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim() || '';
    const mrp = formData.get('mrp') ? Number(formData.get('mrp')) : 0;
    const categoryRaw = formData.get('category');
    const keyFeaturesRaw = formData.get('keyFeatures');
    const variantsRaw = formData.get('variants');
    const images = formData.getAll('images').filter((f) => f && f.size > 0);

    let variants = [];
    if (variantsRaw) {
      try {
        const parsed = JSON.parse(variantsRaw);
        if (Array.isArray(parsed)) variants = parsed;
      } catch {
        variants = [];
      }
    }

    const missing = validateProductFields({ name, variants });
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing: ${missing.join(', ')}` }, { status: 400 });
    }

    let category = [];
    if (categoryRaw) {
      try {
        const parsed = JSON.parse(categoryRaw);
        if (Array.isArray(parsed)) category = parsed;
      } catch {
        category = [];
      }
    }

    let keyFeatures = [];
    if (keyFeaturesRaw) {
      try {
        keyFeatures = JSON.parse(keyFeaturesRaw);
        if (!Array.isArray(keyFeatures)) keyFeatures = [];
      } catch {
        keyFeatures = [];
      }
    }

    keyFeatures = keyFeatures.filter((f) => typeof f === 'string' && f.trim() !== '');

    let imagesUrl = [];
    if (images.length > 0) {
      imagesUrl = await Promise.all(
        images.map(async (image) => {
          const buffer = Buffer.from(await image.arrayBuffer());

          const response = await imagekit.upload({
            file: buffer,
            fileName: image.name,
            folder: 'products',
          });

          return imagekit.url({
            path: response.filePath,
            transformation: [{ quality: 'auto' }, { format: 'webp' }, { width: '1024' }],
          });
        })
      );
    }

    // ── REPLACED CREATE BLOCK ─────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const totalQty = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

      const product = await tx.product.create({
        data: {
          name,
          description,
          mrp,
          quantity: totalQty,
          category,
          keyFeatures,
          images: imagesUrl,
          inStock: totalQty > 0,
          storeId: null,
          createdBy: 'ADMIN',
        },
      });

      if (variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v) => ({
            productId: product.id,
            size: v.size,
            barcode: v.barcode,
            price: Number(v.price),
            stock: Number(v.stock) || 0,
          })),
        });
      }

      return product;
    });

    return NextResponse.json({
      message: 'Global product created successfully',
      product: result,
    });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────
export async function PUT(request) {
  try {
    const { role, storeId } = await resolveRole(request);

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    // ── UPDATED QUERY ─────────────────────────────────────────────
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only edit your own products' }, { status: 403 });
    }

    // ── REPLACED BODY BLOCK ───────────────────────────────────────
    const body = await request.json();

    const { name, description, mrp, category, existingImages, keyFeatures, variants } = body;

    const variantList = Array.isArray(variants) ? variants : [];

    const missing = validateProductFields({
      name,
      variants: variantList,
    });

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing: ${missing.join(', ')}` }, { status: 400 });
    }

    const cleanCategory = Array.isArray(category) ? category : [];

    const images =
      Array.isArray(existingImages) && existingImages.length > 0 ? existingImages : existing.images;

    const cleanKeyFeatures = Array.isArray(keyFeatures)
      ? keyFeatures.filter((f) => typeof f === 'string' && f.trim() !== '')
      : existing.keyFeatures || [];

    const updated = await prisma.$transaction(async (tx) => {
      const totalQty =
        variantList.length > 0
          ? variantList.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
          : existing.quantity;

      const prod = await tx.product.update({
        where: { id: productId },
        data: {
          name,
          description: description || '',
          mrp: Number(mrp) || 0,
          quantity: totalQty,
          category: cleanCategory,
          keyFeatures: cleanKeyFeatures,
          images,
          inStock: totalQty > 0,
        },
      });

      if (variantList.length > 0) {
        const existingVariantIds = (existing.variants || []).map((v) => v.id);

        const incomingWithId = variantList.filter((v) => v.id);
        const incomingNew = variantList.filter((v) => !v.id);

        const keepIds = incomingWithId.map((v) => v.id);

        const toDelete = existingVariantIds.filter((id) => !keepIds.includes(id));

        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        for (const v of incomingWithId) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              size: v.size,
              barcode: v.barcode,
              price: Number(v.price),
              stock: Number(v.stock) || 0,
            },
          });
        }

        if (incomingNew.length > 0) {
          await tx.productVariant.createMany({
            data: incomingNew.map((v) => ({
              productId,
              size: v.size,
              barcode: v.barcode,
              price: Number(v.price),
              stock: Number(v.stock) || 0,
            })),
          });
        }
      }

      return prod;
    });

    return NextResponse.json({
      message: 'Product updated successfully',
      product: updated,
    });
  } catch (error) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const { role, storeId } = await resolveRole(request);

    if (!role) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only delete your own products' }, { status: 403 });
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
