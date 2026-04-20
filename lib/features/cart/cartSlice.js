// lib/features/cart/cartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Async Thunks ──────────────────────────────────────────────────

// Fetch cart from DB
export const fetchCartThunk = createAsyncThunk(
  'cart/fetchCart',
  async ({ getToken }, { rejectWithValue }) => {
    try {
      const token = await getToken();
      const response = await fetch('/api/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch cart');
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Upload cart to DB
export const uploadCartThunk = createAsyncThunk(
  'cart/uploadCart',
  async ({ getToken }, { getState, rejectWithValue }) => {
    try {
      const token = await getToken();
      const items = getState().cart.items;
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) throw new Error('Failed to upload cart');
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ── Initial State ─────────────────────────────────────────────────
const initialState = {
  items: [],
  totalPrice: 0,
  total: 0,
  loading: false,
  error: null,
};

// ── Helpers ───────────────────────────────────────────────────────
function recalculate(state) {
  state.totalPrice = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  state.total = state.items.length;
}

// ── Slice ─────────────────────────────────────────────────────────
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const { product } = action.payload;

      // ✅ storeId MUST be on the product object passed here.
      // ProductCard / ProductDetails should pass product.storeId when calling addToCart.
      // If a product has no storeId (admin global product), storeId will be null —
      // the orders route handles that case with a DB lookup.
      const existing = state.items.find((item) => item.id === product.id);

      if (existing) {
        existing.quantity += product.quantity ?? 1;
        // Refresh storeId in case it was missing from a previous add
        if (product.storeId != null) {
          existing.storeId = product.storeId;
        }
      } else {
        state.items.push({
          ...product,
          quantity: product.quantity ?? 1,
          // Ensure storeId key always exists (null for admin global products)
          storeId: product.storeId ?? null,
        });
      }

      recalculate(state);
    },

    removeFromCart: (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      recalculate(state);
    },

    updateCartQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const item = state.items.find((item) => item.id === id);
      if (item) item.quantity = Math.max(1, quantity);
      recalculate(state);
    },

    clearCart: (state) => {
      state.items = [];
      state.totalPrice = 0;
      state.total = 0;
    },
  },

  extraReducers: (builder) => {
    // fetchCart
    builder
      .addCase(fetchCartThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCartThunk.fulfilled, (state, action) => {
        state.loading = false;
        // ✅ Items from DB include storeId — preserved as-is
        const items = action.payload.items || [];
        // Ensure every item has a storeId key (even if null)
        state.items = items.map((item) => ({
          ...item,
          storeId: item.storeId ?? null,
        }));
        recalculate(state);
      })
      .addCase(fetchCartThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // uploadCart
    builder
      .addCase(uploadCartThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(uploadCartThunk.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(uploadCartThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addToCart, removeFromCart, updateCartQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
