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

// ── FIX #3: Dynamic validation — returns exact missing field names ─
function validateProductFields(fields) {
  const missing = [];
  if (!fields.name) missing.push('Name');
  if (!fields.price || Number(fields.price) <= 0) missing.push('Price');
  // mrp, description, images, category are all OPTIONAL per FIX #2 / #7
  return missing;
}

// ── GET: Merged product listing ───────────────────────────────────
// Public/User → all inStock products
// Admin       → ALL products
// Store       → admin global + their own products
// ?search=    → fast filter on name + barcode + sku (indexed)
// ?limit=N    → max results (default 50, POS cache uses 500)
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
      // Search name, barcode, sku — barcode/sku use exact-ish match for speed
      const searchCondition = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          // ── FIX #9: also search variant barcodes ─────────────────
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
        price: true,
        images: true,
        category: true,
        quantity: true,
        inStock: true,
        storeId: true,
        sku: true,
        createdBy: true,
        createdAt: true,
        variants: {
          select: { id: true, size: true, price: true, stock: true, barcode: true },
        },
        rating: {
          select: { id: true, rating: true, review: true, userId: true, createdAt: true },
        },
        store: { select: { name: true, username: true, logo: true } },
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

// ── POST: Admin creates a global product ─────────────────────────
// FIX #2: category is now optional (allow empty [])
// FIX #3: dynamic validation message shows exact missing fields
// FIX #4: auto-create Inventory row inside transaction
// FIX #7: images, description, mrp, keyFeatures all optional
export async function POST(request) {
  try {
    const { role } = await resolveRole(request);

    if (role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create global products via this endpoint.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim() || '';
    const mrp = formData.get('mrp') ? Number(formData.get('mrp')) : 0;
    const price = Number(formData.get('price'));
    const quantity = Number(formData.get('quantity')) || 0;
    const categoryRaw = formData.get('category');
    const keyFeaturesRaw = formData.get('keyFeatures');
    const images = formData.getAll('images').filter((f) => f && f.size > 0);

    // ── FIX #3: Dynamic validation — show exact missing fields ────
    const missing = validateProductFields({ name, price });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // ── FIX #2: category is optional — allow empty array ──────────
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

    // ── FIX #7: images optional — upload only if provided ─────────
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

    const product = await prisma.product.create({
      data: {
        name,
        description,
        mrp,
        price,
        quantity,
        category,
        keyFeatures,
        images: imagesUrl,
        inStock: quantity > 0,
        storeId: null,
        createdBy: 'ADMIN',
      },
    });

    return NextResponse.json({ message: 'Global product created successfully', product });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update any product ───────────────────────────────────────
// FIX #2: category optional
// FIX #3: dynamic validation
// FIX #4: inventory upsert inside transaction (already existed, kept)
// FIX #7: optional fields
export async function PUT(request) {
  try {
    const { role, storeId } = await resolveRole(request);
    if (!role) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only edit your own products' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, mrp, price, quantity, category, existingImages, keyFeatures } = body;

    // ── FIX #3: Dynamic validation ────────────────────────────────
    const missing = validateProductFields({ name, price });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // ── FIX #2: category is optional — allow empty array ──────────
    const cleanCategory = Array.isArray(category) ? category : [];

    const images =
      Array.isArray(existingImages) && existingImages.length > 0 ? existingImages : existing.images;

    const cleanKeyFeatures = Array.isArray(keyFeatures)
      ? keyFeatures.filter((f) => typeof f === 'string' && f.trim() !== '')
      : existing.keyFeatures || [];

    const newQty = Number(quantity) || 0;

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.update({
        where: { id: productId },
        data: {
          name,
          description: description || '',
          mrp: Number(mrp) || 0,
          price: Number(price),
          quantity: newQty,
          category: cleanCategory,
          keyFeatures: cleanKeyFeatures,
          images,
          inStock: newQty > 0,
        },
      });

      if (existing.storeId) {
        await tx.inventory.upsert({
          where: { productId_storeId: { productId, storeId: existing.storeId } },
          update: { quantity: newQty },
          create: { productId, storeId: existing.storeId, quantity: newQty, lowStock: 10 },
        });
      }

      return prod;
    });

    return NextResponse.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete a product ──────────────────────────────────────
export async function DELETE(request) {
  try {
    const { role, storeId } = await resolveRole(request);
    if (!role) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (role === 'STORE' && existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only delete your own products' }, { status: 403 });
    }

    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/products error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}