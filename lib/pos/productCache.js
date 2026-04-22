/**
 * lib/pos/productCache.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Product cache layer for the offline-first POS system.
 *
 * STRATEGY: Stale-While-Revalidate
 * ──────────────────────────────────
 * 1. Return cached data immediately (instant UI)
 * 2. Fetch fresh data from server in background
 * 3. Update cache silently — no loading spinners
 * 4. Notify caller via callback when fresh data arrives
 *
 * CACHE STORAGE
 * ─────────────
 * Primary:   IndexedDB (products_cache store via posDB)
 * Secondary: localStorage — timestamp + count only (for quick staleness check)
 *
 * BARCODE LOOKUP
 * ──────────────
 * Products are stored with a flat barcode index for O(1) lookup:
 *   _barcodeIndex: { [barcode_lowercase]: { productId, variantId } }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cacheProducts, getCachedProducts, openPosDB } from './posDB';

// ─── Constants ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS           = 10 * 60 * 1000; // 10 min — stale threshold
const BACKGROUND_REFRESH_MS  = 5 * 60 * 1000;  // 5 min — background refresh interval
const LS_CACHE_TS_KEY        = (storeId) => `pos_products_ts_${storeId}`;
const LS_CACHE_COUNT_KEY     = (storeId) => `pos_products_count_${storeId}`;

// ─── In-memory layer ──────────────────────────────────────────────────────────
// Keeps the product array in memory so barcode scans never touch IDB.
// NEW
const _memCache = {
  storeId: null,
  products: [],
  barcodeIndex: {},   // barcode_lc → { product, variant }
  nameIndex: [],      // sorted array of { nameLc, skuLc, product } for fast prefix search
  loadedAt: 0,
};

// ─── Barcode index builder ────────────────────────────────────────────────────

/**
 * Build a flat barcode → { product, variant } index from a product array.
 * Case-insensitive: all keys are stored lowercase.
 *
 * @param {object[]} products
 * @returns {object}
 */
function buildBarcodeIndex(products) {
  const index = {};
  for (const product of products) {
    for (const variant of product.variants || []) {
      if (variant.barcode) {
        index[variant.barcode.trim().toLowerCase()] = { product, variant };
      }
    }
  }
  return index;
}

function buildNameIndex(products) {
  return products.map((product) => ({
    nameLc: (product.name || '').toLowerCase(),
    skuLc:  (product.sku  || '').toLowerCase(),
    product,
  }));
}



/**
 * Hydrate the in-memory cache from a product array.
 */
function hydrate(storeId, products) {
  _memCache.storeId      = storeId;
  _memCache.products     = products;
  _memCache.barcodeIndex = buildBarcodeIndex(products);
  _memCache.nameIndex    = buildNameIndex(products);
  _memCache.loadedAt     = Date.now();
}
// ─── localStorage metadata ────────────────────────────────────────────────────

function getCacheTimestamp(storeId) {
  try {
    return parseInt(localStorage.getItem(LS_CACHE_TS_KEY(storeId)) || '0', 10);
  } catch {
    return 0;
  }
}

function setCacheTimestamp(storeId, count) {
  try {
    localStorage.setItem(LS_CACHE_TS_KEY(storeId), String(Date.now()));
    localStorage.setItem(LS_CACHE_COUNT_KEY(storeId), String(count));
  } catch (_) {}
}

function isCacheStale(storeId) {
  const ts = getCacheTimestamp(storeId);
  return Date.now() - ts > CACHE_TTL_MS;
}

// ─── API fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch fresh products from the server.
 *
 * @param {string} storeId
 * @param {string} token         — auth token (store owner or employee)
 * @param {string} [searchQuery] — optional search filter
 * @returns {Promise<object[]>}  — products with variants
 */
export async function fetchProductsFromServer(storeId, token, searchQuery = '') {
  const url = searchQuery
    ? `/api/store/products-for-billing?search=${encodeURIComponent(searchQuery)}`
    : '/api/store/products-for-billing';

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);

  const data = await res.json();
  return data.products || [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the product cache.
 *
 * 1. Returns cached data immediately (from IndexedDB or memory).
 * 2. If stale (or empty), fetches fresh data in background.
 * 3. Calls `onRefresh(products)` when fresh data is available.
 *
 * @param {object} options
 * @param {string}   options.storeId
 * @param {string}   options.token           — auth token
 * @param {function} [options.onRefresh]     — called with fresh products array
 * @param {boolean}  [options.forceRefresh]  — skip staleness check
 *
 * @returns {Promise<object[]>}  — immediately available products (may be stale)
 */
export async function initProductCache({
  storeId,
  token,
  onRefresh,
  forceRefresh = false,
}) {
  // 1. If memory cache is warm for this store, return immediately
  if (_memCache.storeId === storeId && _memCache.products.length > 0) {
    const stale = forceRefresh || isCacheStale(storeId);
    if (stale && navigator.onLine) {
      _backgroundRefresh(storeId, token, onRefresh);
    }
    return _memCache.products;
  }

  // 2. Load from IndexedDB
  let cached = [];
  try {
    cached = await getCachedProducts(storeId);
  } catch (_) {}

  if (cached.length > 0) {
    hydrate(storeId, cached);
    // Background refresh if stale
    if ((forceRefresh || isCacheStale(storeId)) && navigator.onLine) {
      _backgroundRefresh(storeId, token, onRefresh);
    }
    return _memCache.products;
  }

  // 3. Cache is empty — must fetch synchronously (first load)
  if (navigator.onLine) {
    try {
      const fresh = await fetchProductsFromServer(storeId, token);
      await _persistAndHydrate(storeId, fresh);
      onRefresh?.(fresh);
      return fresh;
    } catch (err) {
      console.warn('[productCache] Initial fetch failed:', err.message);
    }
  }

  return [];
}

/**
 * Force refresh the product cache from the server.
 * Updates memory + IndexedDB, then calls onRefresh.
 *
 * @param {string}   storeId
 * @param {string}   token
 * @param {function} [onRefresh]
 */
export async function refreshProductCache(storeId, token, onRefresh) {
  if (!navigator.onLine) return;
  try {
    const fresh = await fetchProductsFromServer(storeId, token);
    await _persistAndHydrate(storeId, fresh);
    onRefresh?.(fresh);
  } catch (err) {
    console.warn('[productCache] Refresh failed:', err.message);
  }
}

/**
 * Search products by name or SKU.
 * Always uses the in-memory cache — instant, no async.
 *
 * @param {string} query
 * @param {number} [limit=8]
 * @returns {object[]}
 */
// NEW — uses pre-built index, no toLowerCase per item
export function searchProducts(query, limit = 8) {
  const q = query?.trim().toLowerCase();
  if (!q || !_memCache.nameIndex.length) return [];

  const results = [];
  for (let i = 0; i < _memCache.nameIndex.length; i++) {
    const entry = _memCache.nameIndex[i];
    if (entry.nameLc.includes(q) || entry.skuLc.includes(q)) {
      results.push(entry.product);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/**
 * Find a variant by barcode — O(1) index lookup.
 * Case-insensitive.
 *
 * @param {string} barcode
 * @returns {{ product: object, variant: object } | null}
 */
export function findVariantByBarcode(barcode) {
  if (!barcode) return null;
  const key = barcode.trim().toLowerCase();
  return _memCache.barcodeIndex[key] ?? null;
}

/**
 * Get all cached products (from memory).
 * @returns {object[]}
 */
export function getCachedProductsSync() {
  return _memCache.products;
}

/**
 * Get cache metadata.
 */
export function getCacheInfo(storeId) {
  return {
    count: _memCache.products.length,
    loadedAt: _memCache.loadedAt,
    stale: isCacheStale(storeId),
    barcodes: Object.keys(_memCache.barcodeIndex).length,
  };
}

/**
 * Create a background auto-refresh scheduler.
 * Call start() once on mount, stop() on unmount.
 *
 * @param {object} options
 * @param {string}   options.storeId
 * @param {string}   options.token
 * @param {function} [options.onRefresh]
 * @returns {{ start, stop }}
 */
export function createRefreshScheduler({ storeId, token, onRefresh }) {
  let _timer = null;

  function start() {
    stop();
    _timer = setInterval(() => {
      if (navigator.onLine) {
        refreshProductCache(storeId, token, onRefresh).catch(console.error);
      }
    }, BACKGROUND_REFRESH_MS);
  }

  function stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  return { start, stop };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _persistAndHydrate(storeId, products) {
  try {
    await cacheProducts(storeId, products);
    setCacheTimestamp(storeId, products.length);
  } catch (err) {
    console.warn('[productCache] IDB persist failed:', err.message);
  }
  hydrate(storeId, products);
}

function _backgroundRefresh(storeId, token, onRefresh) {
  // Small delay so it doesn't compete with initial render
  setTimeout(() => {
    refreshProductCache(storeId, token, onRefresh).catch(console.error);
  }, 500);
}