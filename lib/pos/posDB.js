/**
 * lib/pos/posDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB layer for the offline-first POS system.
 * Pure IDB — no Dexie dependency needed.
 *
 * DATABASE SCHEMA
 * ───────────────
 * Each store gets its own namespaced DB: pos_db_{storeId}
 *
 * Object Stores:
 *   products_cache  — keyPath: id        | index: updatedAt
 *   inventory_cache — keyPath: variantId | index: productId, storeId
 *   bills_local     — keyPath: localId   | index: createdAt, synced
 *   sync_queue      — keyPath: localId   | index: createdAt, retryCount
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DB_VERSION = 1;

// ─── Open / upgrade ───────────────────────────────────────────────────────────

/**
 * Open (or create) the POS IndexedDB for a given storeId.
 * Call this once; the returned db handle is cached per storeId.
 *
 * @param {string} storeId
 * @returns {Promise<IDBDatabase>}
 */
const _dbCache = {};

export function openPosDB(storeId = 'default') {
  if (_dbCache[storeId]) return Promise.resolve(_dbCache[storeId]);

  return new Promise((resolve, reject) => {
    const dbName = `pos_db_${storeId}`;
    const req = indexedDB.open(dbName, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ── products_cache ────────────────────────────────────────
      if (!db.objectStoreNames.contains('products_cache')) {
        const ps = db.createObjectStore('products_cache', { keyPath: 'id' });
        ps.createIndex('updatedAt', 'updatedAt', { unique: false });
        ps.createIndex('name', 'name', { unique: false });
      }

      // ── inventory_cache ───────────────────────────────────────
      if (!db.objectStoreNames.contains('inventory_cache')) {
        const inv = db.createObjectStore('inventory_cache', { keyPath: 'variantId' });
        inv.createIndex('productId', 'productId', { unique: false });
        inv.createIndex('storeId', 'storeId', { unique: false });
      }

      // ── bills_local ───────────────────────────────────────────
      if (!db.objectStoreNames.contains('bills_local')) {
        const bl = db.createObjectStore('bills_local', { keyPath: 'localId' });
        bl.createIndex('createdAt', 'createdAt', { unique: false });
        bl.createIndex('synced', 'synced', { unique: false });
        bl.createIndex('billNumber', 'billNumber', { unique: false });
      }

      // ── sync_queue ────────────────────────────────────────────
      if (!db.objectStoreNames.contains('sync_queue')) {
        const sq = db.createObjectStore('sync_queue', { keyPath: 'localId' });
        sq.createIndex('createdAt', 'createdAt', { unique: false });
        sq.createIndex('retryCount', 'retryCount', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      const db = event.target.result;

      // Handle unexpected version change from another tab
      db.onversionchange = () => {
        db.close();
        delete _dbCache[storeId];
      };

      _dbCache[storeId] = db;
      resolve(db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('[posDB] DB open blocked — close other tabs');
  });
}

/**
 * Close and remove cached DB connection for a storeId.
 * Call on logout / store switch.
 */
export function closePosDB(storeId = 'default') {
  if (_dbCache[storeId]) {
    _dbCache[storeId].close();
    delete _dbCache[storeId];
  }
}

// ─── Generic IDB helpers ─────────────────────────────────────────────────────

/**
 * Put (insert or replace) a single record.
 */
export async function dbPut(storeId, storeName, value) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Put many records in a single transaction (bulk write).
 */
export async function dbPutMany(storeId, storeName, values) {
  if (!values?.length) return;
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const os = tx.objectStore(storeName);
    let count = 0;

    values.forEach((v) => {
      const req = os.put(v);
      req.onerror = () => reject(req.error);
    });

    tx.oncomplete = () => resolve(values.length);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a single record by primary key.
 */
export async function dbGet(storeId, storeName, key) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all records in a store.
 */
export async function dbGetAll(storeId, storeName) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all records matching an index value.
 */
export async function dbGetByIndex(storeId, storeName, indexName, value) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a single record by primary key.
 */
export async function dbDelete(storeId, storeName, key) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete all records in a store.
 */
export async function dbClear(storeId, storeName) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Count records in a store.
 */
export async function dbCount(storeId, storeName) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Domain-specific helpers ─────────────────────────────────────────────────

/**
 * Save a bill to both bills_local and sync_queue atomically.
 * Guarantees: bill is never lost even if sync_queue write fails.
 */
export async function saveBillLocally(storeId, bill) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills_local', 'sync_queue'], 'readwrite');

    tx.objectStore('bills_local').put({
      ...bill,
      synced: false,
      savedAt: Date.now(),
    });

    tx.objectStore('sync_queue').put({
      ...bill,
      retryCount: 0,
      lastAttempt: null,
      addedToQueue: Date.now(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Mark a bill as synced: remove from queue, update bills_local.
 */
export async function markBillSynced(storeId, localId, serverBillId) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills_local', 'sync_queue'], 'readwrite');

    // Remove from sync queue
    tx.objectStore('sync_queue').delete(localId);

    // Update bills_local: mark synced + store server ID
    const localStore = tx.objectStore('bills_local');
    const getReq = localStore.get(localId);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        localStore.put({
          ...existing,
          synced: true,
          serverBillId: serverBillId || null,
          syncedAt: Date.now(),
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Increment retry count for a queued bill after a failed sync attempt.
 */
export async function incrementRetryCount(storeId, localId) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const os = tx.objectStore('sync_queue');
    const req = os.get(localId);

    req.onsuccess = () => {
      const bill = req.result;
      if (bill) {
        os.put({
          ...bill,
          retryCount: (bill.retryCount || 0) + 1,
          lastAttempt: Date.now(),
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending bills from sync_queue, sorted oldest-first.
 */
export async function getPendingQueue(storeId) {
  const all = await dbGetAll(storeId, 'sync_queue');
  return all.sort((a, b) => (a.addedToQueue || 0) - (b.addedToQueue || 0));
}

/**
 * Get local bills sorted newest-first (for history display).
 */
export async function getLocalBills(storeId, limit = 200) {
  const all = await dbGetAll(storeId, 'bills_local');
  return all
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

/**
 * Save products array to products_cache (replaces all).
 * Each product must have an `id` field.
 */
export async function cacheProducts(storeId, products) {
  if (!products?.length) return;
  const stamped = products.map((p) => ({ ...p, _cachedAt: Date.now() }));
  await dbClear(storeId, 'products_cache');
  await dbPutMany(storeId, 'products_cache', stamped);
}

/**
 * Get all cached products.
 */
export async function getCachedProducts(storeId) {
  return dbGetAll(storeId, 'products_cache');
}

/**
 * Save inventory array to inventory_cache.
 * Each entry must have a `variantId` field.
 */
export async function cacheInventory(storeId, inventory) {
  if (!inventory?.length) return;
  const stamped = inventory.map((i) => ({ ...i, _cachedAt: Date.now() }));
  await dbPutMany(storeId, 'inventory_cache', stamped);
}

/**
 * Get cached stock for a specific variantId.
 */
export async function getCachedStock(storeId, variantId) {
  const rec = await dbGet(storeId, 'inventory_cache', variantId);
  return rec?.stock ?? null;
}

/**
 * Optimistically deduct stock from inventory_cache when a bill is completed.
 * This keeps the local cache accurate before the server syncs.
 */
export async function deductLocalStock(storeId, items) {
  const db = await openPosDB(storeId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('inventory_cache', 'readwrite');
    const os = tx.objectStore('inventory_cache');

    items.forEach(({ variantId, quantity }) => {
      const req = os.get(variantId);
      req.onsuccess = () => {
        const rec = req.result;
        if (rec) {
          os.put({
            ...rec,
            stock: Math.max(0, (rec.stock || 0) - quantity),
            _deductedLocally: true,
        });
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── DB health / diagnostics ─────────────────────────────────────────────────

/**
 * Returns a summary of DB state for debugging / status display.
 */
export async function getDBStats(storeId) {
  try {
    const [products, bills, queue] = await Promise.all([
      dbCount(storeId, 'products_cache'),
      dbCount(storeId, 'bills_local'),
      dbCount(storeId, 'sync_queue'),
    ]);
    return { products, bills, queueDepth: queue, storeId, ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}