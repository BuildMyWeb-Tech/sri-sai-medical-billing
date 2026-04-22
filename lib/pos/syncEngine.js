/**
 * lib/pos/syncEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Background sync engine for the offline-first POS system.
 *
 * RESPONSIBILITIES
 * ────────────────
 * 1. Drain sync_queue → POST /api/store/billing
 * 2. Retry failed bills with exponential back-off
 * 3. Mark bills as synced in bills_local
 * 4. Emit status events so the UI can react
 * 5. Auto-restart when the browser comes back online
 *
 * RETRY POLICY
 * ────────────
 * Attempt 1 → immediate
 * Attempt 2 → 30 s
 * Attempt 3 → 2 min
 * Attempt 4 → 10 min
 * Attempt 5+ → 30 min
 *
 * MAX_RETRIES = 10   (after that, bill stays in queue but is flagged "failed")
 *
 * USAGE
 * ─────
 * import { createSyncEngine } from '@/lib/pos/syncEngine';
 *
 * const engine = createSyncEngine({
 *   storeId: 'store_abc',
 *   getAuthToken: () => localStorage.getItem('storeToken') || '',
 *   onStatusChange: (status) => console.log(status),
 * });
 *
 * engine.start();   // begin background polling
 * engine.stop();    // clean up on unmount
 * engine.syncNow(); // force immediate attempt
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  getPendingQueue,
  markBillSynced,
  incrementRetryCount,
  dbCount,
} from './posDB';

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS    = 15_000;   // check queue every 15 s
const MAX_RETRIES         = 10;
const BATCH_SIZE          = 10;       // max bills per sync request

const RETRY_DELAYS_MS = [
  0,           // attempt 1 — immediate
  30_000,      // attempt 2 — 30 s
  120_000,     // attempt 3 — 2 min
  600_000,     // attempt 4 — 10 min
  1_800_000,   // attempt 5+ — 30 min
];

function retryDelayFor(retryCount) {
  const idx = Math.min(retryCount, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[idx];
}

// ─── Status shape ─────────────────────────────────────────────────────────────
/**
 * @typedef {'idle' | 'syncing' | 'error' | 'offline'} SyncState
 *
 * @typedef {object} SyncStatus
 * @property {SyncState} state
 * @property {number}    queueDepth    — bills waiting to sync
 * @property {number}    lastSyncAt    — timestamp of last successful sync (0 = never)
 * @property {string|null} lastError   — last error message
 * @property {boolean}   online
 */

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a sync engine instance.
 *
 * @param {object} options
 * @param {string}   options.storeId        — store identifier (used to namespace DB)
 * @param {function} options.getAuthToken   — returns current auth token string
 * @param {string}  [options.syncEndpoint]  — API URL (default: /api/store/billing)
 * @param {function} [options.onStatusChange] — called with SyncStatus whenever state changes
 * @param {function} [options.onBillSynced]   — called with (localId, serverBillId) per bill
 *
 * @returns {{ start, stop, syncNow, getStatus }}
 */
export function createSyncEngine({
  storeId,
  getAuthToken,
  syncEndpoint = '/api/store/billing',
  onStatusChange,
  onBillSynced,
}) {
  // ── Internal state ─────────────────────────────────────────────
  let _running    = false;
  let _syncing    = false;
  let _pollTimer  = null;
  let _lastSyncAt = 0;
  let _lastError  = null;

  /** @type {SyncStatus} */
  const _status = {
    state: 'idle',
    queueDepth: 0,
    lastSyncAt: 0,
    lastError: null,
    online: navigator?.onLine ?? true,
  };

  // ── Emit ───────────────────────────────────────────────────────
  function emit(patch) {
    Object.assign(_status, patch);
    try {
      onStatusChange?.({ ..._status });
    } catch (_) {}
  }

  // ── Network listeners ──────────────────────────────────────────
  function handleOnline() {
    emit({ online: true, state: 'idle' });
    syncNow(); // immediately attempt sync when network returns
  }

  function handleOffline() {
    emit({ online: false, state: 'offline' });
  }

  // ── Queue depth helper ─────────────────────────────────────────
  async function refreshQueueDepth() {
    try {
      const count = await dbCount(storeId, 'sync_queue');
      emit({ queueDepth: count });
      return count;
    } catch {
      return 0;
    }
  }

  // ── Core sync logic ────────────────────────────────────────────

  /**
   * Process up to BATCH_SIZE bills from the queue.
   * Returns { saved, failed, skipped }
   */
  async function processBatch(bills) {
    const token = getAuthToken?.() || '';

    const res = await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(bills),
      // Don't follow redirects to login pages — treat as error
      redirect: 'error',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }

    return res.json(); // { saved: [{localId, billId}], failed: [], skipped: [] }
  }

  /**
   * Main sync tick — drains the queue in batches.
   */
  async function runSync() {
    if (_syncing) return;
    if (!navigator.onLine) {
      emit({ state: 'offline', online: false });
      return;
    }

    const queue = await getPendingQueue(storeId);
    if (!queue.length) {
      emit({ state: 'idle', queueDepth: 0 });
      return;
    }

    // Filter bills that are ready to retry (respect back-off delay)
    const now = Date.now();
    const ready = queue.filter((bill) => {
      if ((bill.retryCount || 0) >= MAX_RETRIES) return false; // permanently failed
      const delay = retryDelayFor(bill.retryCount || 0);
      const lastAttempt = bill.lastAttempt || 0;
      return now - lastAttempt >= delay;
    });

    if (!ready.length) {
      // All bills are in back-off — nothing to do this tick
      emit({ queueDepth: queue.length });
      return;
    }

    _syncing = true;
    emit({ state: 'syncing', queueDepth: queue.length, lastError: null });

    // Process in batches
    const batches = chunkArray(ready, BATCH_SIZE);
    let totalSaved = 0;

    for (const batch of batches) {
      try {
        const { saved = [], failed = [], skipped = [] } = await processBatch(batch);

        // Mark saved bills as synced
        for (const { localId, billId } of saved) {
          await markBillSynced(storeId, localId, billId).catch(console.error);
          onBillSynced?.(localId, billId);
          totalSaved++;
        }

        // Also mark skipped (duplicates already on server) as synced
        for (const { localId, billId } of skipped) {
          await markBillSynced(storeId, localId, billId).catch(console.error);
          totalSaved++;
        }

        // Increment retry count for failed ones
        for (const { localId } of failed) {
          await incrementRetryCount(storeId, localId).catch(console.error);
        }
      } catch (err) {
        // Network / server error — increment retry for whole batch
        _lastError = err.message;
        for (const bill of batch) {
          await incrementRetryCount(storeId, bill.localId).catch(console.error);
        }
        // Stop processing remaining batches on network error
        break;
      }
    }

    _syncing = false;
    const remaining = await refreshQueueDepth();

    if (remaining === 0) {
      _lastSyncAt = Date.now();
      emit({ state: 'idle', queueDepth: 0, lastSyncAt: _lastSyncAt, lastError: null });
    } else if (_lastError) {
      emit({ state: 'error', lastError: _lastError, queueDepth: remaining });
    } else {
      emit({ state: 'idle', queueDepth: remaining });
    }
  }

  // ── Polling ────────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    _pollTimer = setInterval(() => {
      if (navigator.onLine) runSync().catch(console.error);
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Start the sync engine.
   * Safe to call multiple times — won't double-start.
   */
  function start() {
    if (_running) return;
    _running = true;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    emit({ online: navigator.onLine });
    refreshQueueDepth();

    // Run immediately, then start polling
    if (navigator.onLine) runSync().catch(console.error);
    startPolling();
  }

  /**
   * Stop the sync engine and remove listeners.
   * Call on component unmount.
   */
  function stop() {
    _running = false;
    stopPolling();
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    emit({ state: 'idle' });
  }

  /**
   * Force an immediate sync attempt.
   * Safe to call at any time (e.g. after completing a bill).
   */
  async function syncNow() {
    if (!navigator.onLine) return;
    // Small delay to let IndexedDB writes settle
    await sleep(300);
    return runSync().catch(console.error);
  }

  /**
   * Get the current sync status snapshot.
   * @returns {SyncStatus}
   */
  function getStatus() {
    return { ..._status };
  }

  return { start, stop, syncNow, getStatus };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}