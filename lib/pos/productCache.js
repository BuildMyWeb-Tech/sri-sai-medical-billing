/**
 * lib/pos/productCache.js
 * ✅ FINAL STABLE VERSION
 */

import { cacheProducts, getCachedProducts } from './posDB';

// ───────────────── CONFIG ─────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

const LS_CACHE_TS_KEY = (id) => `pos_products_ts_${id}`;

// ───────────────── MEMORY CACHE ─────────────────
const _memCache = {
  storeId: null,
  products: [],
  barcodeIndex: new Map(),
  nameIndex: new Map(),
  loadedAt: 0,
};

// ───────────────── HELPERS ─────────────────
function normalize(val) {
  return String(val || '').trim().toLowerCase();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ───────────────── INDEX BUILDERS ─────────────────
function buildBarcodeIndex(products) {
  const map = new Map();

  for (const product of products || []) {
    for (const variant of product.variants || []) {
      if (variant.barcode) {
        map.set(normalize(variant.barcode), {
          product,
          variant,
        });
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

    if (!map.has(k)) {
      map.set(k, []);
    }

    const arr = map.get(k);

    if (!arr.find((p) => p.id === product.id)) {
      arr.push(product);
    }
  };

  for (const product of products || []) {
    add(product.name, product);
    add(product.sku, product);

    for (const word of (product.name || '').split(' ')) {
      add(word, product);
    }

    for (const variant of product.variants || []) {
      add(variant.barcode, product);
    }
  }

  return map;
}

function hydrate(storeId, products) {
  _memCache.storeId = storeId;
  _memCache.products = products || [];
  _memCache.barcodeIndex = buildBarcodeIndex(products || []);
  _memCache.nameIndex = buildNameIndex(products || []);
  _memCache.loadedAt = Date.now();

  console.log(
    `[POS CACHE] Hydrated ${products?.length || 0} products`
  );
}

// ───────────────── CACHE META ─────────────────
function getCacheTimestamp(storeId) {
  try {
    return parseInt(
      localStorage.getItem(LS_CACHE_TS_KEY(storeId)) || '0'
    );
  } catch {
    return 0;
  }
}

function setCacheTimestamp(storeId) {
  try {
    localStorage.setItem(
      LS_CACHE_TS_KEY(storeId),
      Date.now().toString()
    );
  } catch {}
}

function isStale(storeId) {
  return (
    Date.now() - getCacheTimestamp(storeId) >
    CACHE_TTL_MS
  );
}

// ───────────────── API FETCH ─────────────────
export async function fetchProductsFromServer(
  storeId,
  token,
  search = ''
) {
  try {
    const params = new URLSearchParams();

    if (search) {
      params.set('search', search);
    }

    // ✅ IMPORTANT
    // use CORRECT endpoint
    const url = `/api/store/products-for-billing${
      params.toString() ? `?${params}` : ''
    }`;

    console.log('[POS] Fetching:', url);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      cache: 'no-store',
    });

    const text = await res.text();

    let data = safeJsonParse(text);

    if (!res.ok) {
      console.error('[POS] Fetch failed', {
        status: res.status,
        statusText: res.statusText,
        body: text,
      });

      throw new Error(
        data?.error ||
          `Server error (${res.status})`
      );
    }

    if (!data) {
      throw new Error('Invalid server response');
    }

    // barcode direct match
    if (data.type === 'BARCODE_MATCH') {
      return data.products || [];
    }

    return data.products || [];
  } catch (error) {
    console.error(
      '[POS] fetchProductsFromServer ERROR:',
      error
    );

    throw error;
  }
}

// ───────────────── INIT CACHE ─────────────────
export async function initProductCache({
  storeId,
  token,
  onRefresh,
  forceRefresh = false,
}) {
  try {
    // memory cache
    if (
      _memCache.storeId === storeId &&
      _memCache.products.length
    ) {
      if (forceRefresh && navigator.onLine) {
        const fresh = await fetchProductsFromServer(
          storeId,
          token
        );

        await _persist(storeId, fresh);

        onRefresh?.(fresh);

        return fresh;
      }

      if (isStale(storeId) && navigator.onLine) {
        _backgroundRefresh(
          storeId,
          token,
          onRefresh
        );
      }

      return _memCache.products;
    }

    // indexedDB cache
    let cached = [];

    try {
      cached = await getCachedProducts(storeId);
    } catch (err) {
      console.warn(
        '[POS] IndexedDB cache read failed:',
        err
      );
    }

    if (cached?.length) {
      hydrate(storeId, cached);

      if (
        (forceRefresh || isStale(storeId)) &&
        navigator.onLine
      ) {
        _backgroundRefresh(
          storeId,
          token,
          onRefresh
        );
      }

      return cached;
    }

    // online fetch
    if (navigator.onLine) {
      const fresh = await fetchProductsFromServer(
        storeId,
        token
      );

      await _persist(storeId, fresh);

      onRefresh?.(fresh);

      return fresh;
    }

    return [];
  } catch (error) {
    console.error(
      '[POS] initProductCache ERROR:',
      error
    );

    return [];
  }
}

// ───────────────── SEARCH ─────────────────
export function searchProducts(query, limit = 8) {
  const q = normalize(query);

  if (!q) return [];

  const seen = new Set();
  const results = [];

  for (const [key, products] of _memCache.nameIndex) {
    if (key.includes(q)) {
      for (const product of products) {
        if (!seen.has(product.id)) {
          seen.add(product.id);

          results.push(product);

          if (results.length >= limit) {
            return results;
          }
        }
      }
    }
  }

  return results;
}

// ───────────────── BARCODE LOOKUP ─────────────────
export async function findVariantByBarcode(
  barcode,
  { storeId, token } = {}
) {
  const key = normalize(barcode);

  if (!key) return null;

  // memory lookup
  let result =
    _memCache.barcodeIndex.get(key);

  if (result) {
    return result;
  }

  // API fallback
  const resolvedStoreId =
    storeId || _memCache.storeId;

  if (
    navigator.onLine &&
    resolvedStoreId
  ) {
    try {
      const products =
        await fetchProductsFromServer(
          resolvedStoreId,
          token || '',
          key
        );

      if (products.length) {
        await _persist(
          resolvedStoreId,
          products,
          true
        );

        result =
          _memCache.barcodeIndex.get(key);

        if (result) {
          return result;
        }
      }
    } catch (err) {
      console.warn(
        '[Barcode] API fallback failed:',
        err.message
      );
    }
  }

  return null;
}

// ───────────────── SYNC LOOKUP ─────────────────
export function findVariantByBarcodeSync(
  barcode
) {
  const key = normalize(barcode);

  if (!key) return null;

  return (
    _memCache.barcodeIndex.get(key) || null
  );
}

// ───────────────── HELPERS ─────────────────
export function getCachedProductsSync() {
  return _memCache.products;
}

// ───────────────── REFRESH ─────────────────
export async function refreshProductCache(
  storeId,
  token,
  onRefresh
) {
  try {
    if (!navigator.onLine) return;

    const fresh =
      await fetchProductsFromServer(
        storeId,
        token
      );

    await _persist(storeId, fresh);

    onRefresh?.(fresh);
  } catch (error) {
    console.error(
      '[POS] refreshProductCache ERROR:',
      error
    );
  }
}

// ───────────────── SCHEDULER ─────────────────
export function createRefreshScheduler({
  storeId,
  token,
  onRefresh,
}) {
  let timer;

  function start() {
    stop();

    timer = setInterval(() => {
      if (navigator.onLine) {
        refreshProductCache(
          storeId,
          token,
          onRefresh
        );
      }
    }, BACKGROUND_REFRESH_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
    }
  }

  return { start, stop };
}

// ───────────────── PERSIST ─────────────────
async function _persist(
  storeId,
  products,
  merge = false
) {
  try {
    await cacheProducts(storeId, products);

    setCacheTimestamp(storeId);
  } catch (err) {
    console.warn(
      '[POS] cacheProducts failed:',
      err
    );
  }

  if (
    merge &&
    _memCache.products.length
  ) {
    const existingIds = new Set(
      _memCache.products.map((p) => p.id)
    );

    const merged = [..._memCache.products];

    for (const p of products) {
      if (!existingIds.has(p.id)) {
        merged.push(p);
      } else {
        const idx = merged.findIndex(
          (m) => m.id === p.id
        );

        if (idx >= 0) {
          merged[idx] = p;
        }
      }
    }

    hydrate(storeId, merged);
  } else {
    hydrate(storeId, products);
  }
}

// ───────────────── LOCAL STOCK PATCH ─────────────────
export function patchLocalStock(items) {
  for (const item of items) {
    const { variantId, quantity } = item;

    for (const product of _memCache.products) {
      for (const variant of product.variants || []) {
        if (variant.id === variantId) {
          variant.stock = Math.max(
            0,
            (variant.stock || 0) - quantity
          );
        }
      }
    }

    for (const [, entry] of _memCache.barcodeIndex) {
      if (entry.variant?.id === variantId) {
        entry.variant.stock = Math.max(
          0,
          (entry.variant.stock || 0) - quantity
        );
      }
    }
  }
}

// ───────────────── BACKGROUND REFRESH ─────────────────
function _backgroundRefresh(
  storeId,
  token,
  onRefresh
) {
  refreshProductCache(
    storeId,
    token,
    onRefresh
  ).catch(console.error);
}