// lib/storeSettings.js
// Frontend cache for store settings — used by billing system for fast POS access

let _cachedSettings = null;
let _cacheTime = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch store settings with in-memory cache.
 * On first call (e.g. after login), fetches from API.
 * Subsequent calls return cached value until TTL expires.
 */
export async function getStoreSettings(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && _cachedSettings && _cacheTime && now - _cacheTime < CACHE_TTL_MS) {
    return _cachedSettings;
  }

  try {
    // Include both Clerk session AND employee/store token
    const token =
      typeof window !== 'undefined'
        ? (localStorage.getItem('empToken') ||
           localStorage.getItem('employeeToken') ||
           localStorage.getItem('storeToken') ||
           localStorage.getItem('token') || '')
        : '';

    const res = await fetch('/api/settings', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    _cachedSettings = data.settings;
    _cacheTime = now;
    return _cachedSettings;
  } catch (error) {
    console.error('getStoreSettings error:', error);
    return _cachedSettings; // return stale cache on error
  }
}

/**
 * Invalidate the cache (call after saving new settings)
 */
export function invalidateSettingsCache() {
  _cachedSettings = null;
  _cacheTime = null;
}

/**
 * Calculate tax from a subtotal based on settings.
 * Returns { taxAmount, cgstAmount, sgstAmount, total }
 */
export function calculateTax(subtotal, settings) {
  const sub = parseFloat(subtotal) || 0;
  if (!settings) return { taxAmount: 0, cgstAmount: 0, sgstAmount: 0, total: sub };

  if (settings.taxType === 'GST_SPLIT') {
    const cgst = Number(settings.cgst || 0);
    const sgst = Number(settings.sgst || 0);
    const cgstAmount = parseFloat(((sub * cgst) / 100).toFixed(2));
    const sgstAmount = parseFloat(((sub * sgst) / 100).toFixed(2));
    const taxAmount = parseFloat((cgstAmount + sgstAmount).toFixed(2)); // ← was unrounded
    return {
      taxAmount,
      cgstAmount,
      sgstAmount,
      total: parseFloat((sub + taxAmount).toFixed(2)),
    };
  }

  const taxPct = Number(settings.taxPercent || 0); // ← Number() handles Prisma Decimal
  const taxAmount = parseFloat(((sub * taxPct) / 100).toFixed(2));
  return {
    taxAmount,
    cgstAmount: 0,
    sgstAmount: 0,
    total: parseFloat((sub + taxAmount).toFixed(2)),
  };
}

/**
 * Format currency based on settings.currency
 */
export function formatCurrency(amount, settings) {
  const currency = settings?.currency || 'INR';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,   // ← locks to exactly 2 decimal places always
  }).format(parseFloat(amount) || 0); // ← guard against undefined/null
}

/**
 * Generate invoice data object for printing
 */
export function buildInvoiceData({ settings, items, subtotal }) {
  const { taxAmount, cgstAmount, sgstAmount, total } = calculateTax(subtotal, settings);

  return {
    storeName: settings?.showStoreName ? settings.storeName : null,
    gstNumber: settings?.showGST ? settings.gstNumber : null,
    address: settings?.address || null,
    currency: settings?.currency || 'INR',
    taxType: settings?.taxType || 'SINGLE',
    taxPercent: Number(settings?.taxPercent || 0),
cgst: Number(settings?.cgst || 0),
sgst: Number(settings?.sgst || 0),
    footerMessage: settings?.footerMessage || '',
    items,
    subtotal,
    taxAmount,
    cgstAmount,
    sgstAmount,
    total,
  };
}
