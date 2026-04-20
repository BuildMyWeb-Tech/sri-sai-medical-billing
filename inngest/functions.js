// inngest/functions.js
import { inngest } from './client';
import prisma from '@/lib/prisma';

// ── Sync user creation ────────────────────────────────────────────
export const syncUserCreation = inngest.createFunction(
  { id: 'sync-user-create' },
  { event: 'clerk/user.created' },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.upsert({
      where: { id: data.id },
      update: {},
      create: {
        id: data.id,
        email: data.email_addresses[0].email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
        image: data.image_url,
      },
    });
  }
);

// ── Sync user update ──────────────────────────────────────────────
export const syncUserUpdation = inngest.createFunction(
  { id: 'sync-user-update' },
  { event: 'clerk/user.updated' },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: data.email_addresses[0].email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
        image: data.image_url,
      },
    });
  }
);

// ── Sync user deletion ────────────────────────────────────────────
export const syncUserDeletion = inngest.createFunction(
  { id: 'sync-user-delete' },
  { event: 'clerk/user.deleted' },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.delete({ where: { id: data.id } });
  }
);

// ── Delete expired coupon ─────────────────────────────────────────
export const deleteCouponOnExpiry = inngest.createFunction(
  { id: 'delete-coupon-on-expiry' },
  { event: 'app/coupon.expired' },
  async ({ event, step }) => {
    const { data } = event;
    const expiryDate = new Date(data.expires_at);
    await step.sleepUntil('wait-for-expiry', expiryDate);
    await step.run('delete-coupon-from-database', async () => {
      await prisma.coupon.delete({ where: { code: data.code } });
    });
  }
);

// ── ✅ Auto-create Sale record when an order is placed ────────────
// Triggered by: inngest.send({ name: 'app/order.created', data: { orderId } })
// Called from: POST /api/orders after prisma.order.create
export const createSaleOnOrder = inngest.createFunction(
  { id: 'create-sale-on-order' },
  { event: 'app/order.created' },
  async ({ event, step }) => {
    const { orderId } = event.data;

    await step.run('write-sale-record', async () => {
      // Idempotency: skip if Sale already exists for this order
      const existing = await prisma.sale.findFirst({
        where: { referenceId: orderId },
      });
      if (existing) return { skipped: true, saleId: existing.id };

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, storeId: true, total: true, createdAt: true },
      });

      if (!order) throw new Error(`Order ${orderId} not found`);

      const sale = await prisma.sale.create({
        data: {
          storeId: order.storeId,
          amount: order.total,
          source: 'ORDER',
          referenceId: order.id,
          // Preserve the original order timestamp so historical reports are accurate
          createdAt: order.createdAt,
        },
      });

      return { saleId: sale.id };
    });
  }
);
