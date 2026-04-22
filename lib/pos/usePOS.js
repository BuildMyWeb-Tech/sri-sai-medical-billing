/**
 * lib/pos/usePOS.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Main React hook for the offline-first POS billing system.
 *
 * WHAT THIS HOOK DOES
 * ───────────────────
 * - Manages cart state (add, remove, update qty, discounts)
 * - Loads + searches products from local cache
 * - Completes bills: saves to IndexedDB instantly, queues for sync
 * - Manages the sync engine lifecycle
 * - Exposes sync status for UI indicators
 *
 * USAGE
 * ─────
 * const pos = usePOS({ storeId, getAuthToken, settings });
 *
 * pos.cart            — current cart items
 * pos.addVariant()    — add a product variant to cart
 * pos.removeItem()    — remove by index
 * pos.updateQty()     — update quantity by index
 * pos.completeBill()  — save + queue bill, returns bill data
 * pos.search()        — search local product cache
 * pos.findByBarcode() — barcode lookup
 * pos.syncStatus      — { state, queueDepth, lastSyncAt, online }
 * pos.products        — cached product array
 * pos.localBills      — recent bills from IndexedDB
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  saveBillLocally,
  getLocalBills,
  deductLocalStock,
  dbCount,
  closePosDB,
} from './posDB';
import { createSyncEngine } from './syncEngine';
import {
  initProductCache,
  refreshProductCache,
  searchProducts,
  findVariantByBarcode,
  getCachedProductsSync,
  createRefreshScheduler,
} from './productCache';
import { calculateTax, formatCurrency } from '@/lib/storeSettings';

// ─── Local bill ID generator ──────────────────────────────────────────────────
function generateLocalId(prefix = 'bill') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateBillNumber(prefix = 'BILL') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = String(now.getTime()).slice(-5);
  return `${prefix}-${date}-${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// usePOS hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string}   options.storeId          — required for DB namespacing
 * @param {function} options.getAuthToken     — () => string
 * @param {object}  [options.settings]        — store settings (tax, currency, etc.)
 * @param {string}  [options.billPrefix]      — bill number prefix (default 'BILL')
 * @param {function} [options.onBillComplete] — called with billData after save
 */
export function usePOS({
  storeId,
  getAuthToken,
  settings = null,
  billPrefix = 'BILL',
  onBillComplete,
}) {
  // ── Cart ─────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [note, setNote] = useState('');

  // ── Products ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);

  // ── Sync status ───────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState({
    state: 'idle',
    queueDepth: 0,
    lastSyncAt: 0,
    lastError: null,
    online: true,
  });

  // ── Local bills (history) ─────────────────────────────────────────────────
  const [localBills, setLocalBills] = useState([]);
  const [completing, setCompleting] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const syncEngineRef = useRef(null);
  const refreshSchedulerRef = useRef(null);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity - (item.itemDiscount || 0),
    0
  );
  const discounted = Math.max(0, subtotal - Number(billDiscount || 0));
  const taxResult  = calculateTax(discounted, settings);
  const grandTotal = taxResult.total;
  const fmt        = (n) => formatCurrency(n, settings);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return;

    const token = getAuthToken?.() || '';

    // 1. Load products
    initProductCache({
      storeId,
      token,
      onRefresh: (fresh) => setProducts([...fresh]),
    })
      .then((cached) => {
        if (cached.length) setProducts([...cached]);
      })
      .catch(console.error);

    // 2. Start background refresh scheduler
    refreshSchedulerRef.current = createRefreshScheduler({
      storeId,
      token,
      onRefresh: (fresh) => setProducts([...fresh]),
    });
    refreshSchedulerRef.current.start();

    // 3. Start sync engine
    syncEngineRef.current = createSyncEngine({
      storeId,
      getAuthToken,
      onStatusChange: (status) => setSyncStatus({ ...status }),
      onBillSynced: (localId, serverBillId) => {
        // Update localBills to reflect synced state
        setLocalBills((prev) =>
          prev.map((b) =>
            b.localId === localId
              ? { ...b, synced: true, serverBillId }
              : b
          )
        );
      },
    });
    syncEngineRef.current.start();

    // 4. Load local bills for history
    getLocalBills(storeId).then((bills) => setLocalBills(bills)).catch(console.error);

    // 5. Initial queue depth
    dbCount(storeId, 'sync_queue')
      .then((count) => setSyncStatus((s) => ({ ...s, queueDepth: count })))
      .catch(console.error);

    return () => {
      syncEngineRef.current?.stop();
      refreshSchedulerRef.current?.stop();
    };
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cart helpers ──────────────────────────────────────────────────────────

  /**
   * Build a cart item from a product + variant.
   */
  const buildCartItem = useCallback((product, variant) => ({
    productId:    product.id,
    variantId:    variant.id,
    name:         product.name,
    size:         variant.size || null,
    price:        Number(variant.price),
    quantity:     1,
    itemDiscount: 0,
    total:        Number(variant.price),
    stock:        variant.stock ?? 9999,
  }), []);

  /**
   * Add a variant to the cart.
   * Returns: { added: true } | { duplicate: true, existingIdx: number } | { outOfStock: true }
   */
  const addVariant = useCallback(
    (product, variant) => {
      if (variant.stock === 0) {
        return { outOfStock: true };
      }

      const existingIdx = cart.findIndex((i) => i.variantId === variant.id);
      if (existingIdx >= 0) {
        return { duplicate: true, existingIdx };
      }

      setCart((prev) => [...prev, buildCartItem(product, variant)]);
      return { added: true };
    },
    [cart, buildCartItem]
  );

  /**
   * Increase quantity of an existing cart item (used for duplicate scan).
   */
  const increaseQty = useCallback(
    (idx) => {
      setCart((prev) =>
        prev.map((item, i) => {
          if (i !== idx) return item;
          const newQty = Math.min(item.quantity + 1, item.stock || 9999);
          return {
            ...item,
            quantity: newQty,
            total: item.price * newQty - (item.itemDiscount || 0),
          };
        })
      );
    },
    []
  );

  /**
   * Add a duplicate variant as a new row.
   */
  const addAsNewRow = useCallback(
    (product, variant) => {
      setCart((prev) => [
        ...prev,
        { ...buildCartItem(product, variant), variantId: `${variant.id}_${Date.now()}` },
      ]);
    },
    [buildCartItem]
  );

  /**
   * Update quantity for a cart item by index.
   */
  const updateQty = useCallback((idx, qty) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const newQty = Math.max(1, Math.min(qty, item.stock || 9999));
        return {
          ...item,
          quantity: newQty,
          total: item.price * newQty - (item.itemDiscount || 0),
        };
      })
    );
  }, []);

  /**
   * Update per-item discount.
   */
  const updateItemDiscount = useCallback((idx, discount) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const d = Math.max(0, Math.min(Number(discount || 0), item.price * item.quantity));
        return { ...item, itemDiscount: d, total: item.price * item.quantity - d };
      })
    );
  }, []);

  /**
   * Remove a cart item by index.
   */
  const removeItem = useCallback((idx) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /**
   * Clear the entire cart and reset bill fields.
   */
  const clearCart = useCallback(() => {
    setCart([]);
    setBillDiscount(0);
    setNote('');
    setPaymentMode('CASH');
  }, []);

  // ── Product search ────────────────────────────────────────────────────────

  /**
   * Search products by name/SKU — uses in-memory cache, instant.
   * @param {string} query
   * @param {number} [limit=8]
   * @returns {object[]}
   */
  const search = useCallback((query, limit = 8) => {
    return searchProducts(query, limit);
  }, []);

  /**
   * Find a variant by barcode — O(1) index lookup.
   * @param {string} barcode
   * @returns {{ product, variant } | null}
   */
  const findByBarcode = useCallback((barcode) => {
    return findVariantByBarcode(barcode);
  }, []);

  // ── Complete bill ─────────────────────────────────────────────────────────

  /**
   * Complete the current bill.
   *
   * 1. Saves to IndexedDB instantly (no API wait)
   * 2. Deducts stock from local inventory cache
   * 3. Fires inventory/deduct API in background (if online)
   * 4. Queues bill for background sync
   * 5. Triggers immediate sync attempt
   * 6. Returns bill data immediately
   *
   * @param {object} [overrides] — optional field overrides
   * @returns {Promise<{ ok: true, bill: object } | { ok: false, error: string }>}
   */
  const completeBill = useCallback(
    async (overrides = {}) => {
      if (!cart.length) return { ok: false, error: 'Cart is empty' };
      if (!storeId)     return { ok: false, error: 'No storeId' };

      setCompleting(true);

      const localId    = generateLocalId(billPrefix.toLowerCase());
      const billNumber = generateBillNumber(billPrefix);
      const now        = Date.now();

      const finalDiscount = Number(overrides.billDiscount ?? billDiscount ?? 0);
      const finalPayment  = overrides.paymentMode ?? paymentMode;
      const finalNote     = overrides.note ?? note;

      // Re-compute totals at save time (in case settings changed mid-session)
      const itemsTotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity - (item.itemDiscount || 0),
        0
      );
      const discountedTotal = Math.max(0, itemsTotal - finalDiscount);
      const tax             = calculateTax(discountedTotal, settings);

      const billData = {
        localId,
        billNumber,
        storeId,
        subtotal:    parseFloat(itemsTotal.toFixed(2)),
        discount:    parseFloat(finalDiscount.toFixed(2)),
        taxAmount:   parseFloat(tax.taxAmount.toFixed(2)),
        total:       parseFloat(tax.total.toFixed(2)),
        paymentMode: finalPayment,
        note:        finalNote || null,
        createdAt:   now,
        synced:      false,
        items: cart.map((item) => ({
          productId:  item.productId,
          variantId:  item.variantId,
          name:       item.name,
          size:       item.size || null,
          price:      item.price,
          quantity:   item.quantity,
          discount:   item.itemDiscount || 0,
          total:      parseFloat((item.price * item.quantity - (item.itemDiscount || 0)).toFixed(2)),
        })),
        // Embed settings snapshot for offline receipt printing
        settings: {
          storeName:     settings?.storeName,
          gstNumber:     settings?.gstNumber,
          address:       settings?.address,
          taxType:       settings?.taxType,
          taxPercent:    settings?.taxPercent,
          cgst:          settings?.cgst,
          sgst:          settings?.sgst,
          footerMessage: settings?.footerMessage,
          currency:      settings?.currency,
          showGST:       settings?.showGST,
          showStoreName: settings?.showStoreName,
        },
      };

      try {
        // ── 1. Save to IndexedDB atomically ───────────────────────
        await saveBillLocally(storeId, billData);

        // ── 2. Optimistic local stock deduction ───────────────────
        await deductLocalStock(
          storeId,
          cart.map(({ variantId, quantity }) => ({ variantId, quantity }))
        ).catch(console.error); // non-fatal

        // ── 3. Update local bills list ────────────────────────────
        setLocalBills((prev) => [billData, ...prev].slice(0, 300));

        // ── 4. Update queue count in sync status ──────────────────
        setSyncStatus((s) => ({ ...s, queueDepth: s.queueDepth + 1 }));

        // ── 5. Background: fire inventory/deduct API ──────────────
        if (navigator.onLine) {
          const token = getAuthToken?.() || '';
          fetch('/api/inventory/deduct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              billId: billNumber,
              items:  cart.map(({ productId, variantId, quantity }) => ({
                productId,
                variantId,
                quantity,
              })),
            }),
          }).catch(console.error); // fire-and-forget
        }

        // ── 6. Clear cart ─────────────────────────────────────────
        clearCart();

        // ── 7. Trigger background sync (after a short delay) ──────
        setTimeout(() => {
          syncEngineRef.current?.syncNow();
        }, 2000);

        // ── 8. Notify caller ──────────────────────────────────────
        onBillComplete?.(billData);

        return { ok: true, bill: billData };
      } catch (err) {
        console.error('[usePOS] completeBill error:', err);
        return { ok: false, error: err.message };
      } finally {
        setCompleting(false);
      }
    },
    [
      cart,
      storeId,
      billPrefix,
      billDiscount,
      paymentMode,
      note,
      settings,
      getAuthToken,
      clearCart,
      onBillComplete,
    ]
  );

  // ── Manual sync trigger ───────────────────────────────────────────────────
  const syncNow = useCallback(() => {
    syncEngineRef.current?.syncNow();
  }, []);

  // ── Refresh product cache ─────────────────────────────────────────────────
  const refreshProducts = useCallback(() => {
    const token = getAuthToken?.() || '';
    refreshProductCache(storeId, token, (fresh) => setProducts([...fresh])).catch(console.error);
  }, [storeId, getAuthToken]);

  // ── Reload local bills ────────────────────────────────────────────────────
  const reloadLocalBills = useCallback(() => {
    getLocalBills(storeId).then(setLocalBills).catch(console.error);
  }, [storeId]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    // Cart state
    cart,
    setCart,
    billDiscount,
    setBillDiscount,
    paymentMode,
    setPaymentMode,
    note,
    setNote,

    // Cart actions
    addVariant,
    increaseQty,
    addAsNewRow,
    updateQty,
    updateItemDiscount,
    removeItem,
    clearCart,

    // Computed totals
    subtotal,
    discounted,
    taxResult,
    grandTotal,
    fmt,

    // Products
    products,
    search,
    findByBarcode,
    refreshProducts,

    // Bills
    localBills,
    reloadLocalBills,
    completing,
    completeBill,

    // Sync
    syncStatus,
    syncNow,
  };
}