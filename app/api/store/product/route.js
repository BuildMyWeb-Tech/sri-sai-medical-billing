import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import imagekit from '@/configs/imageKit';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ── Helper: Resolve store safely ───────────────────────────────
async function getStoreIdOrThrow(userId) {
  try {
    const storeId = await authSeller(userId);

    if (!storeId) {
      return { error: 'Store not found or not approved', status: 403 };
    }

    return { storeId };
  } catch (err) {
    return { error: 'Database connection issue. Please try again.', status: 500 };
  }
}

// ── POST ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const result = await getStoreIdOrThrow(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { storeId } = result;

    const formData = await request.formData();

    const name = formData.get('name');
    const description = formData.get('description');
    const mrp = Number(formData.get('mrp'));
    const categoryRaw = formData.get('category');
    const keyFeaturesRaw = formData.get('keyFeatures');
    const variantsRaw = formData.get('variants');
    const images = formData.getAll('images');

    if (!name || !description || !mrp || !categoryRaw || images.length < 1) {
      return NextResponse.json({ error: 'Missing product details' }, { status: 400 });
    }

    let category = JSON.parse(categoryRaw);
    let keyFeatures = keyFeaturesRaw ? JSON.parse(keyFeaturesRaw) : [];
    let variantList = JSON.parse(variantsRaw);

    // Validate variants
    if (!Array.isArray(variantList) || variantList.length === 0) {
      return NextResponse.json({ error: 'At least one variant required' }, { status: 400 });
    }

    // Upload images
    const imagesUrl = await Promise.all(
      images.map(async (image) => {
        const buffer = Buffer.from(await image.arrayBuffer());
        const res = await imagekit.upload({
          file: buffer,
          fileName: image.name,
          folder: 'products',
        });

        return imagekit.url({
          path: res.filePath,
          transformation: [{ quality: 'auto' }, { format: 'webp' }],
        });
      })
    );

    const totalStock = variantList.reduce((sum, v) => sum + Number(v.stock), 0);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          description,
          mrp,
          price: Math.min(...variantList.map((v) => Number(v.price))),
          quantity: totalStock,
          category,
          keyFeatures,
          images: imagesUrl,
          inStock: totalStock > 0,
          storeId,
          createdBy: 'STORE',
        },
      });

      await tx.productVariant.createMany({
        data: variantList.map((v) => ({
          productId: created.id,
          size: v.size,
          barcode: v.barcode,
          price: Number(v.price),
          stock: Number(v.stock),
        })),
      });

      return created;
    });

    return NextResponse.json({ message: 'Product added successfully', product });
  } catch (error) {
    console.error('POST ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// ── GET ────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    const result = await getStoreIdOrThrow(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { storeId } = result;

    const products = await prisma.product.findMany({
      where: { storeId },
      include: {
        variants: true,
        inventory: true,
      },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('GET ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PUT ────────────────────────────────────────────────────────
// REPLACE only this function in app/api/store/product/route.js
// Everything else (POST, GET, DELETE, imports) stays exactly the same.

export async function PUT(request) {
  try {
    const { userId } = getAuth(request);
    const result = await getStoreIdOrThrow(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { storeId } = result;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    const body = await request.json();

    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const variantList = body.variants || [];

    const updated = await prisma.$transaction(async (tx) => {
      // Update core product fields
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          name: body.name,
          description: body.description,
          mrp: Number(body.mrp),
          category: body.category,
          keyFeatures: body.keyFeatures,
          images: body.existingImages,
          // Recalculate aggregates if variants provided
          ...(variantList.length > 0 && {
            price: Math.min(...variantList.map((v) => Number(v.price))),
            quantity: variantList.reduce((sum, v) => sum + Number(v.stock), 0),
            inStock: variantList.some((v) => Number(v.stock) > 0),
          }),
        },
      });

      if (variantList.length > 0) {
        // Upsert each variant: update if id present, create if new
        for (const v of variantList) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                size: v.size,
                barcode: v.barcode,
                price: Number(v.price),
                stock: Number(v.stock),
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId,
                size: v.size,
                barcode: v.barcode,
                price: Number(v.price),
                stock: Number(v.stock),
              },
            });
          }
        }

        // Remove variants that were deleted in the form
        const incomingIds = variantList.filter((v) => v.id).map((v) => v.id);
        await tx.productVariant.deleteMany({
          where: {
            productId,
            id: { notIn: incomingIds },
          },
        });
      }

      return updatedProduct;
    });

    return NextResponse.json({ message: 'Updated', product: updated });
  } catch (error) {
    console.error('PUT ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const { userId } = getAuth(request);
    const result = await getStoreIdOrThrow(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { storeId } = result;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    const existing = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('DELETE ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}