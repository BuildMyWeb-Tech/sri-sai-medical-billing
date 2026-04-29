// inngest/functions.js
import { inngest } from './client';
import prisma from '@/lib/prisma';

// ── Sync user creation ────────────────────────────────────────────
export const syncUserCreation = inngest.createFunction(
  {
    id: 'sync-user-create',
    triggers: [{ event: 'clerk/user.created' }],
  },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.upsert({
      where: { id: data.id },
      update: {},
      create: {
        id: data.id,
        email: data.email_addresses[0].email_address,
        name:
          `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
        image: data.image_url,
      },
    });
  }
);

// ── Sync user update ──────────────────────────────────────────────
export const syncUserUpdation = inngest.createFunction(
  {
    id: 'sync-user-update',
    triggers: [{ event: 'clerk/user.updated' }],
  },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: data.email_addresses[0].email_address,
        name:
          `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
        image: data.image_url,
      },
    });
  }
);

// ── Sync user deletion ────────────────────────────────────────────
export const syncUserDeletion = inngest.createFunction(
  {
    id: 'sync-user-delete',
    triggers: [{ event: 'clerk/user.deleted' }],
  },
  async ({ event }) => {
    const { data } = event;

    await prisma.user.delete({
      where: { id: data.id },
    });
  }
);

// ── Delete expired coupon ─────────────────────────────────────────
export const deleteCouponOnExpiry = inngest.createFunction(
  {
    id: 'delete-coupon-on-expiry',
    triggers: [{ event: 'app/coupon.expired' }],
  },
  async ({ event, step }) => {
    const { data } = event;
    const expiryDate = new Date(data.expires_at);

    await step.sleepUntil('wait-for-expiry', expiryDate);

    await step.run('delete-coupon-from-db', async () => {
      await prisma.coupon.delete({
        where: { code: data.code },
      });
    });
  }
);

// ── Auto-create Sale when Order is created ────────────────────────
export const createSaleOnOrder = inngest.createFunction(
  {
    id: 'create-sale-on-order',
    triggers: [{ event: 'app/order.created' }],
  },
  async ({ event, step }) => {
    const { orderId } = event.data;

    await step.run('write-sale-record', async () => {
      // Prevent duplicate
      const existing = await prisma.sale.findFirst({
        where: { referenceId: orderId },
      });

      if (existing) {
        return { skipped: true, saleId: existing.id };
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          storeId: true,
          total: true,
          createdAt: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const sale = await prisma.sale.create({
        data: {
          storeId: order.storeId,
          amount: order.total,
          source: 'ORDER',
          referenceId: order.id,
          createdAt: order.createdAt,
        },
      });

      return { saleId: sale.id };
    });
  }
);