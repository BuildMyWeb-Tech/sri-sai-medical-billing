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
 * BARCODE LOOKUP  — O(1) via Map
 * ──────────────────────────────
 * barcodeIndex: Map<barcode_lc, { product, variant }>
 *
 * SEARCH INDEX    — O(k) prefix lookup via Map
 * ─────────────────────────────────────────────
 * nameIndex: Map<word_lc, product[]>
 * Splits product names + SKU into words, indexes each word.
 * Prefix-matches first (fast), then falls back to substring scan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { cacheProducts, getCachedProducts } from './posDB';

// ─── Constants ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS          = 10 * 60 * 1000; // 10 min — stale threshold
const BACKGROUND_REFRESH_MS =  5 * 60 * 1000; // 5 min  — background refresh interval
const LS_CACHE_TS_KEY    = (id) => `pos_products_ts_${id}`;
const LS_CACHE_COUNT_KEY = (id) => `pos_products_count_${id}`;

// ─── In-memory layer ──────────────────────────────────────────────────────────
// Single shared object — never reassigned, only mutated via hydrate().
const _memCache = {
  storeId:      null,
  products:     [],          // full product array with variants
  barcodeIndex: new Map(),   // barcode_lc  → { product, variant }
  nameIndex:    new Map(),   // word_lc     → product[]
  loadedAt:     0,
};

// ─── Index builders ───────────────────────────────────────────────────────────

/**
 * Build a flat barcode → { product, variant } Map from a product array.
 * Case-insensitive: all keys are stored lowercase.
 *
 * @param {object[]} products
 * @returns {Map<string, { product: object, variant: object }>}
 */
function buildBarcodeIndex(products) {
  const map = new Map();
  for (const product of products) {
    for (const variant of product.variants || []) {
      if (variant.barcode) {
        map.set(variant.barcode.trim().toLowerCase(), { product, variant });
      }
    }
  }
  return map;
}

/**
 * Build a word → product[] Map for fast prefix/substring search.
 * Indexes every whitespace-separated word in product name + SKU.
 * Case-insensitive: all keys lowercase.
 *
 * @param {object[]} products
 * @returns {Map<string, object[]>}
 */
function buildNameIndex(products) {
  const map = new Map();

  const addEntry = (key, product) => {
    if (!key) return;
    const k = key.toLowerCase();
    if (!map.has(k)) map.set(k, []);
    // Avoid duplicates within same word bucket
    const bucket = map.get(k);
    if (!bucket.includes(product)) bucket.push(product);
  };

  for (const product of products) {
    // Index each word of the product name
    const words = (product.name || '').split(/\s+/);
    for (const word of words) {
      if (word.length >= 1) addEntry(word, product);
    }
    // Index full name (for exact-match boost)
    addEntry((product.name || '').replace(/\s+/g, ''), product);
    // Index SKU
    if (product.sku) addEntry(product.sku, product);
    // Index barcode at product level too (some products have top-level barcode)
    if (product.barcode) addEntry(product.barcode, product);
  }

  return map;
}

/**
 * Hydrate the in-memory cache from a product array.
 * Builds both indexes synchronously — called once per load/refresh.
 *
 * @param {string}   storeId
 * @param {object[]} products
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
  return Date.now() - getCacheTimestamp(storeId) > CACHE_TTL_MS;
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
 * @param {object}   options
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
  // 1. Memory cache is warm for this store → return immediately
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
    if ((forceRefresh || isCacheStale(storeId)) && navigator.onLine) {
      _backgroundRefresh(storeId, token, onRefresh);
    }
    return _memCache.products;
  }

  // 3. Cache empty — must fetch synchronously (first load)
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
 * Uses in-memory Map indexes — no async, no array scan on first pass.
 *
 * ALGORITHM:
 *  1. Prefix-match every key in nameIndex that starts with `q`  → O(k·n) where k = matches
 *  2. If results < limit, fall back to substring scan of product array
 *
 * @param {string} query
 * @param {number} [limit=8]
 * @returns {object[]}
 */
export function searchProducts(query, limit = 8) {
  const q = query?.trim().toLowerCase();
  if (!q || !_memCache.products.length) return [];

  const seen    = new Set();
  const results = [];

  // Pass 1 — prefix match via nameIndex (fast path)
  for (const [key, prods] of _memCache.nameIndex) {
    if (key.startsWith(q)) {
      for (const p of prods) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          results.push(p);
          if (results.length >= limit) return results;
        }
      }
    }
  }

  // Pass 2 — substring fallback (handles mid-word queries like "irt" → "shirt")
  if (results.length < limit) {
    for (const p of _memCache.products) {
      if (seen.has(p.id)) continue;
      if (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      ) {
        seen.add(p.id);
        results.push(p);
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}

/**
 * Find a variant by barcode — O(1) Map lookup.
 * Case-insensitive.
 *
 * @param {string} barcode
 * @returns {{ product: object, variant: object } | null}
 */
export function findVariantByBarcode(barcode) {
  if (!barcode) return null;
  const key = barcode.trim().toLowerCase();
  return _memCache.barcodeIndex.get(key) ?? null;
}

/**
 * Get all cached products (from memory).
 * @returns {object[]}
 */
export function getCachedProductsSync() {
  return _memCache.products;
}

/**
 * Get cache metadata for debugging / UI display.
 *
 * @param {string} storeId
 * @returns {object}
 */
export function getCacheInfo(storeId) {
  return {
    count:    _memCache.products.length,
    loadedAt: _memCache.loadedAt,
    stale:    isCacheStale(storeId),
    barcodes: _memCache.barcodeIndex.size,
    indexed:  _memCache.nameIndex.size,
  };
}

/**
 * Create a background auto-refresh scheduler.
 * Call start() once on mount, stop() on unmount.
 *
 * @param {object}   options
 * @param {string}   options.storeId
 * @param {string}   options.token
 * @param {function} [options.onRefresh]
 * @returns {{ start: function, stop: function }}
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