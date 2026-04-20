// app/api/inngest/route.js
import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import {
  syncUserCreation,
  syncUserUpdation,
  syncUserDeletion,
  deleteCouponOnExpiry,
  createSaleOnOrder, // ✅ NEW — auto Sale record on order placed
} from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncUserCreation,
    syncUserUpdation,
    syncUserDeletion,
    deleteCouponOnExpiry,
    createSaleOnOrder, // ✅ registered here
  ],
});
