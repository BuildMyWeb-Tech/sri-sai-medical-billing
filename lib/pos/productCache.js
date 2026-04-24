/**
 * lib/pos/productCache.js
 * 🔥 FINAL VERSION (PRODUCTION POS READY)
 */

import { cacheProducts, getCachedProducts } from './posDB';

// ─── CONFIG ─────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

const LS_CACHE_TS_KEY = (id) => `pos_products_ts_${id}`;

// ─── MEMORY CACHE ───────────────────────────────────────
const _memCache = {
  storeId: null,
  products: [],
  barcodeIndex: new Map(),
  nameIndex: new Map(),
  loadedAt: 0,
};

// ─── NORMALIZER (VERY IMPORTANT FOR SCANNER) ────────────
function normalize(val) {
  return String(val || '').trim().toLowerCase();
}

// ─── INDEX BUILDERS ─────────────────────────────────────
function buildBarcodeIndex(products) {
  const map = new Map();

  for (const product of products) {
    for (const variant of product.variants || []) {
      if (variant.barcode) {
        map.set(normalize(variant.barcode), { product, variant });
      }
    }
  }

  return map;
}

function buildNameIndex(products) {
  const map = new Map();

  const add = (key, product) => {
    const k = normalize(key);
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    const arr = map.get(k);
    if (!arr.includes(product)) arr.push(product);
  };

  for (const product of products) {
    add(product.name, product);
    add(product.sku, product);

    for (const word of (product.name || '').split(' ')) {
      add(word, product);
    }

    for (const v of product.variants || []) {
      add(v.barcode, product);
    }
  }

  return map;
}

function hydrate(storeId, products) {
  _memCache.storeId = storeId;
  _memCache.products = products;
  _memCache.barcodeIndex = buildBarcodeIndex(products);
  _memCache.nameIndex = buildNameIndex(products);
  _memCache.loadedAt = Date.now();
}

// ─── CACHE META ─────────────────────────────────────────
function getCacheTimestamp(storeId) {
  try {
    return parseInt(localStorage.getItem(LS_CACHE_TS_KEY(storeId)) || '0');
  } catch {
    return 0;
  }
}

function setCacheTimestamp(storeId) {
  try {
    localStorage.setItem(LS_CACHE_TS_KEY(storeId), Date.now());
  } catch {}
}

function isStale(storeId) {
  return Date.now() - getCacheTimestamp(storeId) > CACHE_TTL_MS;
}

// ─── API FETCH ──────────────────────────────────────────
export async function fetchProductsFromServer(storeId, token, search = '') {
  const url = search
    ? `/api/store/products-for-billing?search=${encodeURIComponent(search)}`
    : '/api/store/products-for-billing';

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error('Fetch failed');

  const data = await res.json();

  // 🔥 IMPORTANT: handle barcode direct response
  if (data.type === 'BARCODE_MATCH') {
    return data.products || [];
  }

  return data.products || [];
}

// ─── INIT CACHE ─────────────────────────────────────────
export async function initProductCache({
  storeId,
  token,
  onRefresh,
  forceRefresh = false,
}) {
  if (_memCache.storeId === storeId && _memCache.products.length) {
    if ((forceRefresh || isStale(storeId)) && navigator.onLine) {
      _backgroundRefresh(storeId, token, onRefresh);
    }
    return _memCache.products;
  }

  let cached = [];
  try {
    cached = await getCachedProducts(storeId);
  } catch {}

  if (cached.length) {
    hydrate(storeId, cached);

    if ((forceRefresh || isStale(storeId)) && navigator.onLine) {
      _backgroundRefresh(storeId, token, onRefresh);
    }

    return cached;
  }

  if (navigator.onLine) {
    const fresh = await fetchProductsFromServer(storeId, token);
    await _persist(storeId, fresh);
    onRefresh?.(fresh);
    return fresh;
  }

  return [];
}

// ─── SEARCH ─────────────────────────────────────────────
export function searchProducts(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  const seen = new Set();
  const results = [];

  for (const [key, products] of _memCache.nameIndex) {
    if (key.includes(q)) {
      for (const p of products) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          results.push(p);
          if (results.length >= limit) return results;
        }
      }
    }
  }

  return results;
}

// ─── 🔥 BARCODE LOOKUP (UPGRADED) ───────────────────────
export async function findVariantByBarcode(barcode, { storeId, token } = {}) {
  const key = normalize(barcode);
  if (!key) return null;

  // ⚡ STEP 1: MEMORY CACHE
  let result = _memCache.barcodeIndex.get(key);

  if (result) return result;

  // ⚡ STEP 2: FALLBACK → API (VERY IMPORTANT)
  if (navigator.onLine) {
    try {
      const products = await fetchProductsFromServer(storeId, token, key);

      if (products.length) {
        await _persist(storeId, products);

        // retry after hydrate
        result = _memCache.barcodeIndex.get(key);
        if (result) return result;
      }
    } catch (err) {
      console.warn('Barcode fallback failed:', err.message);
    }
  }

  return null;
}

// ─── HELPERS ───────────────────────────────────────────
export function getCachedProductsSync() {
  return _memCache.products;
}

export function createRefreshScheduler({ storeId, token, onRefresh }) {
  let timer;

  function start() {
    stop();
    timer = setInterval(() => {
      if (navigator.onLine) {
        refreshProductCache(storeId, token, onRefresh);
      }
    }, BACKGROUND_REFRESH_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return { start, stop };
}

export async function refreshProductCache(storeId, token, onRefresh) {
  if (!navigator.onLine) return;

  const fresh = await fetchProductsFromServer(storeId, token);
  await _persist(storeId, fresh);
  onRefresh?.(fresh);
}

// ─── INTERNAL ──────────────────────────────────────────
async function _persist(storeId, products) {
  try {
    await cacheProducts(storeId, products);
    setCacheTimestamp(storeId);
  } catch {}
  hydrate(storeId, products);
}

function _backgroundRefresh(storeId, token, onRefresh) {
  setTimeout(() => {
    refreshProductCache(storeId, token, onRefresh);
  }, 500);
}