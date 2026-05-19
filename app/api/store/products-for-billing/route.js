// app/api/store/products-for-billing/route.js

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────
// Resolve Store Context
// ─────────────────────────────────────────────
async function resolveStoreId(request) {
  try {
    const authHeader =
      request.headers.get('authorization') || '';

    // Employee token auth
    if (authHeader.startsWith('Bearer ')) {
      try {
        const emp = verifyEmployeeToken(request);

        if (emp?.storeId) {
          return {
            storeId: emp.storeId,
            role: 'EMPLOYEE',
            employeeId: emp.id,
          };
        }
      } catch (err) {
        console.error(
          'verifyEmployeeToken error:',
          err?.message
        );
      }
    }

    // Clerk store owner auth
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
  } catch (error) {
    console.error(
      'resolveStoreId error:',
      error
    );

    return {
      storeId: null,
      role: null,
      employeeId: null,
    };
  }
}

// ─────────────────────────────────────────────
// GET PRODUCTS FOR BILLING
// ─────────────────────────────────────────────
export async function GET(request) {
  try {
    const { storeId, role } =
      await resolveStoreId(request);

    if (!storeId) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const rawSearch =
      searchParams.get('search') || '';

    const search = rawSearch.trim();

    const limit = Math.min(
      500,
      Math.max(
        1,
        parseInt(
          searchParams.get('limit') || '200',
          10
        )
      )
    );

    // ─────────────────────────────────────────
    // WHERE CLAUSE
    // ─────────────────────────────────────────
    const where = {
      storeId,
      isDeleted: false,

      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            sku: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            variants: {
              some: {
                barcode: {
                  contains: search,
                },
              },
            },
          },
        ],
      }),
    };

    // ─────────────────────────────────────────
    // FETCH PRODUCTS
    // ─────────────────────────────────────────
    const products =
      await prisma.product.findMany({
        where,

        select: {
          id: true,
          name: true,
          sku: true,
          mrp: true,
          quantity: true,
          inStock: true,
          images: true,
          createdAt: true,

          variants: {
            select: {
              id: true,
              size: true,
              price: true,
              stock: true,
              barcode: true,

              // ✅ LIVE BATCHES
              batches: {
                where: {
                  remainingQty: {
                    gt: 0,
                  },
                },

                select: {
                  id: true,

                  // ✅ FIXED FIELD NAME
                  batchNumber: true,

                  expiryDate: true,
                  quantity: true,
                  remainingQty: true,

                  createdAt: true,
                  updatedAt: true,
                },

                orderBy: [
                  {
                    expiryDate: 'asc',
                  },
                  {
                    createdAt: 'asc',
                  },
                ],
              },
            },

            orderBy: {
              size: 'asc',
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: limit,
      });

    // ─────────────────────────────────────────
    // BARCODE DIRECT MATCH
    // ─────────────────────────────────────────
    // ─────────────────────────────────────────
    // BARCODE DIRECT MATCH
    // Supports duplicate barcodes across products/variants.
    // Returns BARCODE_SINGLE (1 match → auto-add) or
    // BARCODE_DUPLICATE (>1 matches → show picker modal).
    // ─────────────────────────────────────────
    if (search) {
      // Collect all { product, variant } pairs that exactly match this barcode
      const barcodeMatches = [];
      for (const product of products) {
        for (const variant of product.variants || []) {
          if (String(variant.barcode || '').trim() === search) {
            barcodeMatches.push({ product, variant });
          }
        }
      }

      if (barcodeMatches.length === 1) {
        // Exactly one match — caller can auto-add without showing a picker
        return NextResponse.json({
          type: 'BARCODE_SINGLE',
          role,
          product: barcodeMatches[0].product,
          variant: barcodeMatches[0].variant,
        });
      }

      if (barcodeMatches.length > 1) {
        // Multiple matches — caller must show a disambiguation modal
        return NextResponse.json({
          type: 'BARCODE_DUPLICATE',
          role,
          barcode: search,
          matches: barcodeMatches.map(({ product, variant }) => ({
            product,
            variant,
          })),
        });
      }
    }

    // ─────────────────────────────────────────
    // SUCCESS RESPONSE
    // ─────────────────────────────────────────
    return NextResponse.json({
      type: 'PRODUCT_LIST',
      role,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error(
      'GET /api/store/products-for-billing error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to fetch products',
      },
      {
        status: 500,
      }
    );
  }
}