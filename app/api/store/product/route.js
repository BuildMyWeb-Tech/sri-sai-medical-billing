// app/api/store/product/route.js
//
// FIX #2: category is optional — allow empty []
// FIX #3: dynamic validation message shows exact missing fields
// FIX #4: CRITICAL — auto-create Inventory row after product creation (inside transaction)
// FIX #7: images, description, mrp, keyFeatures all optional
// FIX #8: variants always expected (but product can still save without them)

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import imagekit from '@/configs/imageKit';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Resolve store context ─────────────────────────────────────────
async function resolveStore(request) {
  // Try employee JWT first
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) return { storeId: emp.storeId, role: 'EMPLOYEE', employeeId: emp.id };
  }

  // Fall back to Clerk session
  const { userId } = getAuth(request);
  if (userId) {
    const storeId = await authSeller(userId);
    if (storeId) return { storeId, role: 'STORE', employeeId: null };
  }

  return { storeId: null, role: null, employeeId: null };
}

// ── FIX #3: Dynamic validation — returns exact missing field names ─
function validateProductFields(fields) {
  const missing = [];
  if (!fields.name) missing.push('Name');
  if (!fields.price || Number(fields.price) <= 0) missing.push('Price');
  // mrp, description, images, category → all OPTIONAL
  return missing;
}

// ── GET: List store products ──────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId } = await resolveStore(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // ✅ Get search term from URL
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("search") || "";

    console.log("🔍 Incoming search:", searchTerm);

    const products = await prisma.product.findMany({
      where: {
        storeId,
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            variants: {
              some: {
                barcode: searchTerm,
              },
            },
          },
        ],
      },
      include: {
        variants: {
          select: {
            id: true,
            size: true,
            price: true,
            stock: true,
            barcode: true,
          },
          orderBy: { size: "asc" },
        },
        inventory: {
          where: { storeId },
          select: { quantity: true, lowStock: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

   // ✅ Debug logs
console.log("📦 Products found:", products.length);

// Print ALL products (full structure)
console.log("🧪 All products:", products);

// Optional: cleaner readable format
products.forEach((p, i) => {
  console.log(`🔹 Product #${i + 1}`, {
    id: p.id,
    name: p.name,
    sku: p.sku,
    variants: p.variants,
  });
});

    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET /api/store/product error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Store creates a product ─────────────────────────────────
// FIX #4: CRITICAL — auto-create Inventory row inside transaction
export async function POST(request) {
  try {
    const { storeId, employeeId } = await resolveStore(request);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const formData = await request.formData();
    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim() || '';
    const mrp = formData.get('mrp') ? Number(formData.get('mrp')) : 0;
    const price = Number(formData.get('price') || 0);
    const categoryRaw = formData.get('category');
    const keyFeaturesRaw = formData.get('keyFeatures');
    const variantsRaw = formData.get('variants');
    const images = formData.getAll('images').filter((f) => f && f.size > 0);

    // ── FIX #3: Dynamic validation ────────────────────────────────
    const missing = validateProductFields({ name, price });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // ── FIX #2: category is optional — allow empty [] ─────────────
    let category = [];
    if (categoryRaw) {
      try {
        const parsed = JSON.parse(categoryRaw);
        if (Array.isArray(parsed)) category = parsed;
      } catch {
        category = [];
      }
    }

    // ── FIX #7: keyFeatures optional ─────────────────────────────
    let keyFeatures = [];
    if (keyFeaturesRaw) {
      try {
        const parsed = JSON.parse(keyFeaturesRaw);
        if (Array.isArray(parsed)) {
          keyFeatures = parsed.filter((f) => typeof f === 'string' && f.trim() !== '');
        }
      } catch {
        keyFeatures = [];
      }
    }

    // ── FIX #8: parse variants ────────────────────────────────────
    let variants = [];
    if (variantsRaw) {
      try {
        const parsed = JSON.parse(variantsRaw);
        if (Array.isArray(parsed)) variants = parsed;
      } catch {
        variants = [];
      }
    }

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

    // ── FIX #4: CRITICAL — use transaction to create product + inventory ──
    const result = await prisma.$transaction(async (tx) => {
      // Compute total quantity from variants
      const totalQty = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

      // Create the product
      const product = await tx.product.create({
        data: {
          name,
          description,
          mrp,
          price,
          quantity: totalQty,
          category,
          keyFeatures,
          images: imagesUrl,
          inStock: totalQty > 0,
          storeId,
          createdBy: 'STORE',
        },
      });

      // FIX #8: Create variants with barcode/price/stock
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

      // ── FIX #4: AUTO-CREATE Inventory row ─────────────────────
      // This is the critical fix — without this, Inventory page is empty
      await tx.inventory.upsert({
        where: { productId_storeId: { productId: product.id, storeId } },
        update: { quantity: totalQty },
        create: {
          productId: product.id,
          storeId,
          quantity: totalQty,
          lowStock: 10,
        },
      });

      return product;
    });

    return NextResponse.json({ message: 'Product created successfully', product: result });
  } catch (error) {
    console.error('POST /api/store/product error:', error);
    // Handle unique constraint on barcode
    if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        { error: 'One or more barcodes are already in use. Each barcode must be unique.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT: Update store product ─────────────────────────────────────
// FIX #2: category optional
// FIX #3: dynamic validation
// FIX #4: inventory upsert in transaction
export async function PUT(request) {
  try {
    const { storeId } = await resolveStore(request);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only edit your own products' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, mrp, price, category, existingImages, keyFeatures, variants } = body;

    // ── FIX #3: Dynamic validation ────────────────────────────────
    const missing = validateProductFields({ name, price });
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const cleanCategory = Array.isArray(category) ? category : [];
    const images =
      Array.isArray(existingImages) && existingImages.length > 0 ? existingImages : existing.images;
    const cleanKeyFeatures = Array.isArray(keyFeatures)
      ? keyFeatures.filter((f) => typeof f === 'string' && f.trim() !== '')
      : existing.keyFeatures || [];

    const updated = await prisma.$transaction(async (tx) => {
      // Compute new quantity from variants if provided
      const variantList = Array.isArray(variants) ? variants : [];
      const totalQty = variantList.length > 0
        ? variantList.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
        : existing.quantity;

      const prod = await tx.product.update({
        where: { id: productId },
        data: {
          name,
          description: description || '',
          mrp: Number(mrp) || 0,
          price: Number(price),
          quantity: totalQty,
          category: cleanCategory,
          keyFeatures: cleanKeyFeatures,
          images,
          inStock: totalQty > 0,
        },
      });

      // Update variants if provided
      if (variantList.length > 0) {
        const existingVariantIds = existing.variants.map((v) => v.id);
        const incomingWithId = variantList.filter((v) => v.id);
        const incomingNew = variantList.filter((v) => !v.id);

        // Delete variants no longer in list
        const keepIds = incomingWithId.map((v) => v.id);
        const toDelete = existingVariantIds.filter((id) => !keepIds.includes(id));
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
        }

        // Update existing variants
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

        // Create new variants
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

      // ── FIX #4: Upsert inventory row ──────────────────────────
      await tx.inventory.upsert({
        where: { productId_storeId: { productId, storeId } },
        update: { quantity: totalQty },
        create: { productId, storeId, quantity: totalQty, lowStock: 10 },
      });

      return prod;
    });

    return NextResponse.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    console.error('PUT /api/store/product error:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        { error: 'One or more barcodes are already in use. Each barcode must be unique.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete store product ──────────────────────────────────
export async function DELETE(request) {
  try {
    const { storeId } = await resolveStore(request);
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 });

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only delete your own products' }, { status: 403 });
    }

    await prisma.product.delete({ where: { id: productId } });
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/store/product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}