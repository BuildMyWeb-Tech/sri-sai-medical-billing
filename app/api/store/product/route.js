// app/api/store/product/route.js

import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import imagekit from '@/configs/imageKit';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Resolve store context ─────────────────────────────────────────
async function resolveStore(request) {
  const authHeader = request.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) {
      return {
        storeId: emp.storeId,
        role: 'EMPLOYEE',
        employeeId: emp.id,
      };
    }
  }

  const { userId } = getAuth(request);

  if (userId) {
    const storeId = await authSeller(userId);
    if (storeId) {
      return {
        storeId,
        role: 'STORE',
        employeeId: null,
      };
    }
  }

  return {
    storeId: null,
    role: null,
    employeeId: null,
  };
}

// ── REPLACED VALIDATION ───────────────────────────────────────────
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
    const { storeId } = await resolveStore(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search') || '';

    const products = await prisma.product.findMany({
      where: {
        storeId,
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
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
          orderBy: { size: 'asc' },
        },
        inventory: {
          where: { storeId },
          select: {
            quantity: true,
            lowStock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET /api/store/product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { storeId } = await resolveStore(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const formData = await request.formData();

    const name = formData.get('name')?.trim();
    const description = formData.get('description')?.trim() || '';
    const mrp = formData.get('mrp') ? Number(formData.get('mrp')) : 0;

    const categoryRaw = formData.get('category');
    const keyFeaturesRaw = formData.get('keyFeatures');
    const variantsRaw = formData.get('variants');

    const images = formData.getAll('images').filter((f) => f && f.size > 0);

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
        const parsed = JSON.parse(keyFeaturesRaw);

        if (Array.isArray(parsed)) {
          keyFeatures = parsed.filter((f) => typeof f === 'string' && f.trim() !== '');
        }
      } catch {
        keyFeatures = [];
      }
    }

    let variants = [];

    if (variantsRaw) {
      try {
        const parsed = JSON.parse(variantsRaw);
        if (Array.isArray(parsed)) variants = parsed;
      } catch {
        variants = [];
      }
    }

    // ── REPLACED VALIDATION CALL ────────────────────────────────
    const missing = validateProductFields({
      name,
      variants,
    });

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing: ${missing.join(', ')}` }, { status: 400 });
    }

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

    const result = await prisma.$transaction(async (tx) => {
      const totalQty = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

      // ── REPLACED CREATE DATA (price removed) ──────────────────
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
          storeId,
          createdBy: 'STORE',
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

      await tx.inventory.upsert({
        where: {
          productId_storeId: {
            productId: product.id,
            storeId,
          },
        },
        update: {
          quantity: totalQty,
        },
        create: {
          productId: product.id,
          storeId,
          quantity: totalQty,
          lowStock: 10,
        },
      });

      return product;
    });

    return NextResponse.json({
      message: 'Product created successfully',
      product: result,
    });
  } catch (error) {
    console.error('POST /api/store/product error:', error);

    if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        {
          error: 'One or more barcodes are already in use. Each barcode must be unique.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────
export async function PUT(request) {
  try {
    const { storeId } = await resolveStore(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only edit your own products' }, { status: 403 });
    }

    const body = await request.json();

    // ── REPLACED BODY + VALIDATION ──────────────────────────────
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

      // ── REPLACED UPDATE DATA (price removed) ──────────────────
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
        const existingVariantIds = existing.variants.map((v) => v.id);

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

      await tx.inventory.upsert({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
        update: {
          quantity: totalQty,
        },
        create: {
          productId,
          storeId,
          quantity: totalQty,
          lowStock: 10,
        },
      });

      return prod;
    });

    return NextResponse.json({
      message: 'Product updated successfully',
      product: updated,
    });
  } catch (error) {
    console.error('PUT /api/store/product error:', error);

    if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
      return NextResponse.json(
        {
          error: 'One or more barcodes are already in use. Each barcode must be unique.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const { storeId } = await resolveStore(request);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
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

    if (existing.storeId !== storeId) {
      return NextResponse.json({ error: 'You can only delete your own products' }, { status: 403 });
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/store/product error:', error);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
