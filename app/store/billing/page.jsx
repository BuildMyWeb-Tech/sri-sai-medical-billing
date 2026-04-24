'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, Printer,
  CheckCircle, Wifi, WifiOff, RefreshCw, X, Tag, Receipt,
  AlertCircle, CreditCard, Banknote, Smartphone, Maximize,
  Minimize, History, TrendingUp, Filter, ChevronDown, Eye,
  AlertTriangle, ScanLine, Settings, Plug, PlugZap,
  CheckSquare, Square, Store, Layers,
} from 'lucide-react';
import { calculateTax, formatCurrency } from '@/lib/storeSettings';
import {
  initProductCache,
  searchProducts,
  findVariantByBarcode as findByBarcodeLocal,
} from '@/lib/pos/productCache';

// ─── localStorage / IndexedDB keys ───────────────────────────────────────────
const LS_PRINTER_NAME  = 'store_pos_printer_name';

const DB_NAME    = 'store_pos_billing_db';
const DB_VERSION = 2;
const STORE_LOCAL = 'bills_local';
const STORE_QUEUE = 'bills_queue';
const STORE_ID = 'default'; // or dynamic store id

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_LOCAL)) {
        const s = db.createObjectStore(STORE_LOCAL, { keyPath: 'localId' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE))
        db.createObjectStore(STORE_QUEUE, { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}
async function idbPut(store, val) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = tx.objectStore(store).put(val);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}
async function idbGetAll(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  return new Promise((res, rej) => {
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
async function idbDelete(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}
async function idbCount(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readonly');
  return new Promise((res, rej) => {
    const r = tx.objectStore(store).count();
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

// ─── Product cache (localStorage) ────────────────────────────────────────────
function getStoreToken() {
  try {
    return localStorage.getItem('storeToken') || localStorage.getItem('token') || '';
  } catch { return ''; }
}
function generateBillNumber() {
  const now = new Date();
  return `BILL-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-5)}`;
}

const PAYMENT_MODES = [
  { id: 'CASH',  label: 'Cash',  icon: Banknote   },
  { id: 'CARD',  label: 'Card',  icon: CreditCard  },
  { id: 'UPI',   label: 'UPI',   icon: Smartphone  },
  { id: 'OTHER', label: 'Other', icon: Receipt      },
];
const PM_COLORS = {
  CASH:  'bg-green-100 text-green-700',
  CARD:  'bg-blue-100 text-blue-700',
  UPI:   'bg-purple-100 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

// ─── ESC/POS helpers ──────────────────────────────────────────────────────────
const ESCPOS = {
  INIT:         '\x1B@',
  ALIGN_LEFT:   '\x1Ba\x00',
  ALIGN_CENTER: '\x1Ba\x01',
  BOLD_ON:      '\x1BE\x01',
  BOLD_OFF:     '\x1BE\x00',
  DOUBLE_SIZE:  '\x1D!\x11',
  NORMAL_SIZE:  '\x1D!\x00',
  CUT:          '\x1DVA\x00',
  FEED_3:       '\x1Bd\x03',
  LINE_SPACING: '\x1B3\x20',
};
const PAPER_COLS = 48;
const padR   = (s, w) => String(s ?? '').slice(0, w).padEnd(w);
const padL   = (s, w) => String(s ?? '').slice(0, w).padStart(w);
const twoCol = (label, val, w = PAPER_COLS) => {
  const v = String(val);
  const maxL = w - v.length - 1;
  return String(label).slice(0, maxL).padEnd(maxL) + ' ' + v;
};
const fmtMoney = (n, cur = 'INR') => {
  const num = parseFloat(n || 0);
  return cur === 'INR' ? `Rs.${num.toFixed(2)}` : `${cur}${num.toFixed(2)}`;
};

// ── Build ESC/POS receipt string ──────────────────────────────────────────────
function buildESCPOS(bill, settings = {}) {
  const s   = { ...settings, ...(bill.settings || {}) };
  const cur = s.currency || 'INR';
  const fmt = (n) => fmtMoney(n, cur);
  const W   = PAPER_COLS;
  const div = (c = '-') => c.repeat(W);
  const dateStr = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  let out = '';
  out += ESCPOS.INIT + ESCPOS.LINE_SPACING + ESCPOS.ALIGN_CENTER;
  if (s.showStoreName !== false && s.storeName)
    out += ESCPOS.BOLD_ON + ESCPOS.DOUBLE_SIZE + s.storeName + '\n' + ESCPOS.NORMAL_SIZE + ESCPOS.BOLD_OFF;
  if (s.address) out += s.address + '\n';
  if (s.showGST && s.gstNumber) out += 'GST: ' + s.gstNumber + '\n';
  out += '\n' + ESCPOS.ALIGN_LEFT + div() + '\n';
  out += ESCPOS.BOLD_ON + 'Bill No : ' + bill.billNumber + '\n' + ESCPOS.BOLD_OFF;
  out += 'Date    : ' + dateStr + '\nPayment : ' + bill.paymentMode + '\n';
  if (bill.note) out += 'Note    : ' + String(bill.note).slice(0, 36) + '\n';
  out += div() + '\n' + ESCPOS.BOLD_ON;
  out += padR('Item', 22) + padR('Qty', 4) + padL('Price', 10) + padL('Total', 10) + '\n' + ESCPOS.BOLD_OFF + div() + '\n';

  (bill.items || []).forEach((item) => {
    const name = item.size ? `${item.name} (${item.size})` : item.name;
    out += padR(name, 22) + padR(String(item.quantity), 4) + padL(fmt(item.price), 10) + padL(fmt(item.total), 10) + '\n';
  });

  out += div() + '\n' + twoCol('Subtotal:', fmt(bill.subtotal)) + '\n';
  if (parseFloat(bill.discount) > 0)
    out += ESCPOS.BOLD_ON + twoCol('Discount:', '-' + fmt(bill.discount)) + '\n' + ESCPOS.BOLD_OFF;
  if (parseFloat(bill.taxAmount) > 0) {
    if (s.taxType === 'GST_SPLIT') {
      out += twoCol(`CGST (${s.cgst}%):`, fmt(bill.taxAmount / 2)) + '\n' + twoCol(`SGST (${s.sgst}%):`, fmt(bill.taxAmount / 2)) + '\n';
    } else {
      out += twoCol(`Tax (${s.taxPercent || 0}%):`, fmt(bill.taxAmount)) + '\n';
    }
  }
  out += div('=') + '\n' + ESCPOS.BOLD_ON + ESCPOS.ALIGN_CENTER + ESCPOS.DOUBLE_SIZE + 'TOTAL: ' + fmt(bill.total) + '\n' + ESCPOS.NORMAL_SIZE + ESCPOS.BOLD_OFF;

  // ── Cash change ──────────────────────────────────────────────────────────
  if (bill.paymentMode === 'CASH' && bill.paidAmount != null) {
    out += ESCPOS.ALIGN_LEFT + div() + '\n';
    out += twoCol('Paid:', fmt(bill.paidAmount)) + '\n';
    out += ESCPOS.BOLD_ON + twoCol('Change:', fmt(bill.changeAmount || 0)) + '\n' + ESCPOS.BOLD_OFF;
  }

  out += ESCPOS.ALIGN_CENTER + div() + '\n' + (s.footerMessage || 'Thank You! Visit Again') + '\n\n' + ESCPOS.FEED_3 + ESCPOS.CUT;
  return out;
}

// ── QZ Tray ───────────────────────────────────────────────────────────────────
let _qz = null, _qzConn = false, _qzConnecting = false;
async function loadQZ() {
  if (typeof window === 'undefined') return null;
  if (_qz) return _qz;
  try { const mod = await import('qz-tray'); _qz = mod.default || mod; return _qz; } catch (_) {}
  return new Promise((resolve) => {
    if (window.qz) { _qz = window.qz; return resolve(_qz); }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    s.onload = () => { _qz = window.qz; resolve(_qz); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}
async function connectQZ() {
  if (_qzConn) return { ok: true };
  if (_qzConnecting) { await new Promise((r) => setTimeout(r, 2000)); return _qzConn ? { ok: true } : { ok: false, error: 'Timeout' }; }
  _qzConnecting = true;
  try {
    const qz = await loadQZ();
    if (!qz) throw new Error('QZ unavailable');
    if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 2, delay: 1 });
    _qzConn = true;
    qz.websocket.setClosedCallbacks(() => { _qzConn = false; });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; } finally { _qzConnecting = false; }
}
async function getQZPrinters() {
  const c = await connectQZ();
  if (!c.ok) return [];
  try { const qz = await loadQZ(); return (await qz.printers.find()) || []; } catch { return []; }
}
async function qzPrintRaw(data, printerName) {
  const c = await connectQZ();
  if (!c.ok) return { ok: false, error: c.error };
  try {
    const qz = await loadQZ();
    const cfg = qz.configs.create(printerName, { encoding: 'Cp1252', copies: 1 });
    await qz.print(cfg, [{ type: 'raw', format: 'plain', data }]);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Browser print fallback ────────────────────────────────────────────────────
function browserPrintFallback(bill, settings = {}) {
  const s   = { ...settings, ...(bill.settings || {}) };
  const cur = s.currency || 'INR';
  const fmtN = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(parseFloat(n || 0));
  const dateStr = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const itemRows = (bill.items || []).map((it) => {
    const displayName = it.size ? `${it.name} [${it.size}]` : it.name;
    return `<tr><td class="item-name">${displayName}</td><td class="col-qty">${it.quantity}</td><td class="col-rate">${fmtN(it.price)}</td><td class="col-amt">${fmtN(it.total)}</td></tr>`;
  }).join('');

  let taxRows = '';
  if (s.taxType === 'GST_SPLIT' && parseFloat(bill.taxAmount) > 0) {
    taxRows = `<tr class="summary-row"><td colspan="3">CGST (${s.cgst}%)</td><td class="col-amt">${fmtN(bill.taxAmount / 2)}</td></tr><tr class="summary-row"><td colspan="3">SGST (${s.sgst}%)</td><td class="col-amt">${fmtN(bill.taxAmount / 2)}</td></tr>`;
  } else if (parseFloat(bill.taxAmount) > 0) {
    taxRows = `<tr class="summary-row"><td colspan="3">Tax (${s.taxPercent || 0}%)</td><td class="col-amt">${fmtN(bill.taxAmount)}</td></tr>`;
  }
  const discountRow = parseFloat(bill.discount) > 0
    ? `<tr class="summary-row"><td colspan="3">Discount</td><td class="col-amt">-${fmtN(bill.discount)}</td></tr>` : '';

  // ── Cash-change rows ─────────────────────────────────────────────────────
  const cashChangeRows = (bill.paymentMode === 'CASH' && bill.paidAmount != null)
    ? `<tr class="summary-row cash-paid-row"><td colspan="3">Paid</td><td class="col-amt">${fmtN(bill.paidAmount)}</td></tr>
       <tr class="summary-row cash-change-row"><td colspan="3"><strong>Change</strong></td><td class="col-amt"><strong>${fmtN(bill.changeAmount || 0)}</strong></td></tr>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${bill.billNumber}</title><style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:80mm auto;margin:0mm;}html,body{width:80mm;margin:0;padding:0;background:#fff;color:#000;}body{font-family:Arial,Helvetica,'Liberation Sans',sans-serif;font-size:11.5px;font-weight:500;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.receipt{width:76mm;margin:0 auto;padding:4mm 0 6mm 0;}.store-name{text-align:center;font-size:17px;font-weight:900;letter-spacing:0.5px;margin-bottom:1.5mm;text-transform:uppercase;}.store-address{text-align:center;font-size:10px;font-weight:600;line-height:1.4;margin-bottom:1mm;}.store-gst{text-align:center;font-size:10px;font-weight:700;margin-bottom:1.5mm;}.divider-dash{border:none;border-top:1.5px dashed #000;margin:2mm 0;}.divider-solid{border:none;border-top:2px solid #000;margin:2mm 0;}.divider-double{border:none;border-top:3px double #000;margin:2mm 0;}.meta-block{font-size:10.5px;font-weight:600;line-height:1.6;}.meta-block .bill-no{font-size:11px;font-weight:800;}table{width:100%;border-collapse:collapse;table-layout:fixed;}thead tr{border-bottom:1.5px solid #000;}thead th{font-size:10.5px;font-weight:800;padding:1.5mm 0;text-transform:uppercase;}th.col-item{text-align:left;width:44%;}th.col-qty{text-align:center;width:10%;}th.col-rate{text-align:right;width:23%;}th.col-amt{text-align:right;width:23%;}tbody tr{border-bottom:0.75px dashed #555;}tbody tr:last-child{border-bottom:none;}tbody td{font-size:11px;font-weight:600;padding:2mm 0;vertical-align:top;}td.item-name{text-align:left;word-break:break-word;padding-right:2mm;font-weight:700;}td.col-qty{text-align:center;}td.col-rate{text-align:right;}td.col-amt{text-align:right;font-weight:700;}.summary-section{width:100%;border-collapse:collapse;margin-top:1mm;}.summary-row td{font-size:10.5px;font-weight:600;padding:1mm 0;}.summary-row td:first-child{text-align:left;}.summary-row td.col-amt{text-align:right;font-weight:700;}.subtotal-row td{font-size:11px;font-weight:700;padding:1.5mm 0;}.subtotal-row td:first-child{text-align:left;}.subtotal-row td.col-amt{text-align:right;}.total-row{width:100%;border-collapse:collapse;}.total-row td{font-size:15px;font-weight:900;padding:2mm 0 1mm 0;letter-spacing:0.3px;}.total-row td:first-child{text-align:left;}.total-row td:last-child{text-align:right;}.cash-paid-row td{color:#047857;font-size:11px;border-top:1px dashed #ccc;padding-top:1.5mm;}.cash-change-row td{color:#047857;font-size:12px;}.footer{text-align:center;font-size:10.5px;font-weight:700;margin-top:3mm;letter-spacing:0.3px;}</style></head><body><div class="receipt">${s.showStoreName !== false && s.storeName ? `<div class="store-name">${s.storeName}</div>` : ''}${s.address ? `<div class="store-address">${s.address}</div>` : ''}${s.showGST && s.gstNumber ? `<div class="store-gst">GSTIN: ${s.gstNumber}</div>` : ''}<hr class="divider-dash"><div class="meta-block"><div class="bill-no">Bill No : ${bill.billNumber}</div><div>Date    : ${dateStr}</div><div>Payment : ${bill.paymentMode}</div>${bill.note ? `<div>Note    : ${String(bill.note).slice(0, 42)}</div>` : ''}</div><hr class="divider-dash"><table><thead><tr><th class="col-item">Item</th><th class="col-qty">Qty</th><th class="col-rate">Rate</th><th class="col-amt">Amt</th></tr></thead><tbody>${itemRows}</tbody></table><hr class="divider-solid"><table class="summary-section"><tr class="subtotal-row"><td colspan="3">Subtotal</td><td class="col-amt">${fmtN(bill.subtotal)}</td></tr>${discountRow}${taxRows}</table><hr class="divider-double"><table class="total-row"><tr><td>TOTAL</td><td>${fmtN(bill.total)}</td></tr></table>${cashChangeRows ? `<table class="summary-section">${cashChangeRows}</table>` : ''}<hr class="divider-dash"><div class="footer">${s.footerMessage || 'Thank You! Visit Again'}</div></div><script>window.onload=function(){window.print();setTimeout(function(){window.close();},700);};<\/script></body></html>`;

  const win = window.open('', '_blank', 'width=380,height=680');
  if (win) { win.document.write(html); win.document.close(); }
}

async function printBillAuto(bill, settings, printerName) {
  if (!printerName) { browserPrintFallback(bill, settings); return { method: 'browser', ok: true }; }
  const result = await qzPrintRaw(buildESCPOS(bill, settings), printerName);
  if (result.ok) return { method: 'qz', ok: true };
  browserPrintFallback(bill, settings);
  return { method: 'browser', ok: true, error: result.error };
}

// ─── Memoized cart row ────────────────────────────────────────────────────────
const CartRow = React.memo(function CartRow({
  item, idx, fmt, editingQty, setEditingQty, updateQuantity, updateItemDiscount, removeItem,
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{idx + 1}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
          {item.size && (
            <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-6 bg-indigo-600 text-white rounded text-xs font-bold">{item.size}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{fmt(item.price)} each</span>
          {item.stock !== undefined && item.stock <= 5 && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 rounded-full">Low: {item.stock}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <Tag size={9} className="text-slate-400" />
          <span className="text-[10px] text-slate-400">Discount:</span>
          <input type="number" min="0" value={item.itemDiscount || ''} placeholder="0"
            onChange={(e) => updateItemDiscount(idx, e.target.value)}
            className="w-16 text-[11px] border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => updateQuantity(idx, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={13} /></button>
        <input type="number" min="1"
          value={editingQty?.idx === idx ? editingQty.value : item.quantity}
          onChange={(e) => setEditingQty({ idx, value: e.target.value })}
          onBlur={() => { if (editingQty?.idx === idx) { updateQuantity(idx, parseInt(editingQty.value) || 1); setEditingQty(null); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { updateQuantity(idx, parseInt(editingQty?.value || item.quantity) || 1); setEditingQty(null); } }}
          className="w-12 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={() => updateQuantity(idx, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Plus size={13} /></button>
      </div>
      <div className="text-right flex-shrink-0 w-20">
        <p className="text-sm font-bold text-slate-800">{fmt(item.price * item.quantity - (item.itemDiscount || 0))}</p>
      </div>
      <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0"><Trash2 size={14} /></button>
    </div>
  );
});

// ─── Combined barcode + search input ─────────────────────────────────────────
function CombinedInput({ onScan, onSearch, disabled = false, searchResults, onSelectProduct, searchLoading }) {
  const inputRef  = useRef(null);
  const [value, setValue]           = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx]   = useState(-1);
  const scanTimer  = useRef(null);
  const lockRef    = useRef(null);

  const tryFocus = useCallback(() => {
    if (disabled) return;
    const active = document.activeElement;
    if (!active) { inputRef.current?.focus(); return; }
    const tag = active.tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a'].includes(tag)) return;
    if (active.closest('[role="dialog"]')) return;
    inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (disabled) { clearInterval(lockRef.current); return; }
    tryFocus();
    lockRef.current = setInterval(tryFocus, 500);
    const onClick = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (!['input', 'textarea', 'button', 'select', 'a'].includes(tag) && !e.target.closest('[role="dialog"]'))
        setTimeout(() => inputRef.current?.focus(), 0);
    };
    document.addEventListener('click', onClick);
    return () => { clearInterval(lockRef.current); document.removeEventListener('click', onClick); };
  }, [disabled, tryFocus]);

  useEffect(() => {
    setShowDropdown(searchResults && searchResults.length > 0 && value.trim().length > 0);
    setActiveIdx(-1);
  }, [searchResults, value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => { if (v.trim()) onSearch(v.trim()); }, 80);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = value.trim();
      if (!v) return;
      if (showDropdown && searchResults?.length > 0) {
        const idx = activeIdx >= 0 ? activeIdx : 0;
        if (searchResults[idx]) { onSelectProduct(searchResults[idx]); setValue(''); setShowDropdown(false); return; }
      }
      onScan(v.replace(/\s+/g, ''));
      setValue(''); setShowDropdown(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, (searchResults?.length || 1) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setShowDropdown(false); setValue('');
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500"><ScanLine size={15} /></div>
      <input ref={inputRef} type="text" value={value} onChange={handleChange} onKeyDown={handleKeyDown}
        onFocus={() => searchResults?.length > 0 && value.trim() && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
        disabled={disabled}
        placeholder="Scan barcode or type product name…"
        className="w-full pl-9 pr-28 py-2.5 rounded-xl border-2 border-blue-300 bg-blue-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono disabled:opacity-50"
        autoComplete="off" spellCheck={false} data-barcode-input="true" />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {searchLoading && <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
        {value && <span className="text-[10px] text-blue-500 font-mono bg-blue-100 px-1.5 py-0.5 rounded">{value.length}ch</span>}
        <Search size={13} className="text-blue-400" />
      </div>
      {showDropdown && searchResults && searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden mt-1 max-h-64 overflow-y-auto">
          {searchResults.map((p, i) => (
            <button key={p.id} onMouseDown={() => { onSelectProduct(p); setValue(''); setShowDropdown(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 ${i === activeIdx ? 'bg-blue-50' : ''} ${i !== 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {(p.variants || []).map((v) => (
                    <span key={v.id} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${v.stock === 0 ? 'bg-red-50 text-red-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      {v.size} ₹{v.price}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium flex-shrink-0">
                <Layers size={10} /> {(p.variants || []).length} sizes
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Size picker modal ────────────────────────────────────────────────────────
function SizePickerModal({ product, onConfirm, onClose }) {
  const variants = product.variants || [];
  const [selected, setSelected] = useState([]);
  const toggleVariant = (variant) => {
    if (variant.stock === 0) return;
    setSelected((prev) => prev.find((v) => v.id === variant.id) ? prev.filter((v) => v.id !== variant.id) : [...prev, variant]);
  };
  const isSelected = (variant) => selected.some((v) => v.id === variant.id);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center"><Layers size={20} className="text-indigo-600" /></div>
          <div><h3 className="font-bold text-slate-800">Select Size</h3><p className="text-xs text-slate-500 mt-0.5">{product.name}</p></div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        {variants.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No variants found for this product.</p>
        ) : (
          <div className="space-y-2">
            {variants.map((v) => {
              const isOut = v.stock === 0; const sel = isSelected(v);
              return (
                <button key={v.id} onClick={() => toggleVariant(v)} disabled={isOut}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${isOut ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : sel ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-200' : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg text-xs font-bold transition-all ${isOut ? 'bg-slate-100 text-slate-300' : sel ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                      {sel ? <CheckCircle size={14} /> : v.size}
                    </span>
                    <div className="text-left"><span className="font-semibold">{v.size}</span><span className="ml-2 text-indigo-600">₹{Number(v.price).toLocaleString('en-IN')}</span></div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-50 text-red-500' : v.stock < 5 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    {isOut ? 'Out of stock' : `${v.stock} left`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 text-slate-500 hover:text-slate-700 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 font-medium">Cancel</button>
          <button onClick={() => { if (selected.length > 0) onConfirm(product, selected); }} disabled={selected.length === 0}
            className={`flex-1 py-2.5 text-sm rounded-xl font-semibold transition-all ${selected.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
            {selected.length === 0 ? 'Confirm' : `Confirm (${selected.length} size${selected.length > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Print settings modal ────────────────────────────────────────────────────
function PrintSettingsModal({ onClose, printerName, onPrinterChange, qzStatus }) {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(printerName || '');
  useEffect(() => { fetchPrinters(); }, []);
  const fetchPrinters = async () => {
    setLoading(true);
    try { setPrinters(await getQZPrinters()); } catch (_) { setPrinters([]); } finally { setLoading(false); }
  };
  const qzColors = {
    connected:    'bg-green-100 text-green-700 border-green-300',
    connecting:   'bg-yellow-100 text-yellow-700 border-yellow-300',
    disconnected: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Printer size={20} className="text-slate-600" /></div>
          <div><h3 className="font-bold text-slate-800">Print Settings</h3><p className="text-xs text-slate-400">Thermal printer via QZ Tray</p></div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium mb-4 ${qzColors[qzStatus] || qzColors.disconnected}`}>
          {qzStatus === 'connected' ? <><PlugZap size={15} /> QZ Tray connected</> : qzStatus === 'connecting' ? <><div className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" /> Connecting…</> : <><Plug size={15} /> QZ not running — browser print fallback</>}
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Select Printer</label>
            <button onClick={fetchPrinters} disabled={loading} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="text-sm text-slate-400 py-3 text-center">Loading printers…</div>
          ) : printers.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <button onClick={() => setSelected('')} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${!selected ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                {!selected ? <CheckSquare size={15} /> : <Square size={15} className="text-slate-300" />}
                <span className="italic text-slate-400">None (browser print)</span>
              </button>
              {printers.map((p) => (
                <button key={p} onClick={() => setSelected(p)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${selected === p ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                  {selected === p ? <CheckSquare size={15} /> : <Square size={15} className="text-slate-300" />}
                  <Printer size={13} className="flex-shrink-0 text-slate-400" />
                  <span className="truncate">{p}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 text-center py-2">{qzStatus !== 'connected' ? 'Connect QZ Tray to see printers' : 'No printers found'}</p>
              <input type="text" value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="Enter printer name manually…"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono" />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { onPrinterChange(selected); onClose(); }} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-sm">Save Settings</button>
          <button onClick={onClose} className="px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ MAIN COMPONENT ════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
export default function StoreBillingPage() {
  const [settings, setSettings]   = useState(null);
  const [activeTab, setActiveTab] = useState('billing');

  // Billing
  const [suggestions, setSuggestions]         = useState([]);
  const [cartItems, setCartItems]             = useState([]);
  const [billDiscount, setBillDiscount]       = useState(0);
  const [paymentMode, setPaymentMode]         = useState('CASH');
  // ── NEW: cash-change state ─────────────────────────────────────────────────
  const [paidAmount, setPaidAmount]           = useState('');
  // ──────────────────────────────────────────────────────────────────────────
  const [note, setNote]                       = useState('');
  const [loading, setLoading]                 = useState(false);
  const [successBill, setSuccessBill]         = useState(null);
  const [queueCount, setQueueCount]           = useState(0);
  const [isOnline, setIsOnline]               = useState(true);
  const [syncing, setSyncing]                 = useState(false);
  const [duplicateModal, setDuplicateModal]   = useState(null);
  const [sizePickerModal, setSizePickerModal] = useState(null);
  const [editingQty, setEditingQty]           = useState(null);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState(null);

  // Print
  const [printerName, setPrinterName]           = useState('');
  const [qzStatus, setQzStatus]                 = useState('disconnected');
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [lastPrintMethod, setLastPrintMethod]   = useState(null);

  // History
  const [historyBills, setHistoryBills]       = useState([]);
  const [localBills, setLocalBills]           = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historyTotal, setHistoryTotal]       = useState(0);
  const [historyPage, setHistoryPage]         = useState(1);
  const [todayStats, setTodayStats]           = useState({ count: 0, revenue: 0 });
  const [historySearch, setHistorySearch]     = useState('');
  const [historyPM, setHistoryPM]             = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo]     = useState('');
  const [expandedBill, setExpandedBill]       = useState(null);
  const [showFilters, setShowFilters]         = useState(false);
  const [queueBillIds, setQueueBillIds]       = useState(new Set());

  const syncTimerRef  = useRef(null);
  const historyTimer  = useRef(null);
  const feedbackTimer = useRef(null);

  // ── Memoized totals + cash change ─────────────────────────────────────────
  const { subtotal, discounted, taxResult, grandTotal, changeAmount } = useMemo(() => {
    const sub   = cartItems.reduce((s, i) => s + i.price * i.quantity - (i.itemDiscount || 0), 0);
    const disc  = Math.max(0, sub - Number(billDiscount || 0));
    const tax   = calculateTax(disc, settings);
    const total = tax.total;
    const paid  = paymentMode === 'CASH' ? parseFloat(paidAmount || 0) : 0;
    const change = paid > total ? parseFloat((paid - total).toFixed(2)) : 0;
    return { subtotal: sub, discounted: disc, taxResult: tax, grandTotal: total, changeAmount: change };
  }, [cartItems, billDiscount, settings, paymentMode, paidAmount]);

  const fmt = useCallback((n) => formatCurrency(n, settings), [settings]);

  const showScanFeedback = useCallback((type, message) => {
    clearTimeout(feedbackTimer.current);
    setLastScanFeedback({ type, message });
    feedbackTimer.current = setTimeout(() => setLastScanFeedback(null), 2500);
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  // ── Init ──────────────────────────────────────────────────────────────────
useEffect(() => {
  const init = async () => {
    try {
      const token = getStoreToken();

      // ✅ Load settings
      fetch('/api/store/settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((d) => setSettings(d.settings || null))
        .catch(console.error);

      // ✅ Initialize product cache (NEW SYSTEM)
      await initProductCache({
        storeId: STORE_ID,
        token,
        onRefresh: () => {
          console.log('🔄 Products refreshed in background');
        },
      });

      console.log('✅ Product cache initialized');
    } catch (err) {
      console.error('Init failed:', err);
    }
  };

  init();

  // ✅ Online / Offline
  const onOnline = () => {
    setIsOnline(true);
    triggerSync();
    // ❌ removed refreshProductCache()
  };

  const onOffline = () => setIsOnline(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  setIsOnline(navigator.onLine);

  // ✅ Load local DB
  refreshQueueCount();

  idbGetAll(STORE_LOCAL).then((b) =>
    setLocalBills(b.sort((a, b2) => b2.createdAt - a.createdAt))
  );

  idbGetAll(STORE_QUEUE).then((q) =>
    setQueueBillIds(new Set(q.map((b) => b.localId)))
  );

  // ✅ Fullscreen listener
  const onFS = () => setIsFullscreen(!!document.fullscreenElement);
  document.addEventListener('fullscreenchange', onFS);

  // ✅ Printer
  const savedPrinter = localStorage.getItem(LS_PRINTER_NAME) || '';
  setPrinterName(savedPrinter);
  initQZConnection();

  // ✅ Background sync
  const bgSync = setInterval(() => {
    if (navigator.onLine) runSync();
  }, 15000);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('fullscreenchange', onFS);
    clearTimeout(syncTimerRef.current);
    clearTimeout(feedbackTimer.current);
    clearInterval(bgSync);
  };
}, []); // eslint-disable-line

  const initQZConnection = async () => {
    setQzStatus('connecting');
    const r = await connectQZ();
    setQzStatus(r.ok ? 'connected' : 'disconnected');
  };
  const handlePrinterChange = (name) => {
    setPrinterName(name);
    try { localStorage.setItem(LS_PRINTER_NAME, name); } catch (_) {}
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setSuggestions([]); setSizePickerModal(null); setShowPrintSettings(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (activeTab === 'history') loadHistory(1); }, [activeTab, historyPM, historyDateFrom, historyDateTo]); // eslint-disable-line
  useEffect(() => {
    if (activeTab !== 'history') return;
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => loadHistory(1), 400);
    return () => clearTimeout(historyTimer.current);
  }, [historySearch]); // eslint-disable-line

  // ── Search — local only ───────────────────────────────────────────────────
  const handleSearch = useCallback((query) => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    setSuggestions(searchProducts(q, 8));
  }, []);

  // ── History ───────────────────────────────────────────────────────────────
  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const token  = getStoreToken();
      const params = new URLSearchParams({
        page: String(page), limit: '50',
        ...(historySearch && { search: historySearch }),
        ...(historyPM && { paymentMode: historyPM }),
        ...(historyDateFrom && { dateFrom: historyDateFrom }),
        ...(historyDateTo && { dateTo: historyDateTo }),
      });
      const res  = await fetch(`/api/store/billing?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      setHistoryBills(data.bills || []);
      setHistoryTotal(data.total || 0);
      setHistoryPage(page);
      setTodayStats(data.todayStats || { count: 0, revenue: 0 });
    } catch (e) { console.warn('History load failed:', e); } finally { setHistoryLoading(false); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(console.error);
    else document.exitFullscreen().catch(console.error);
  };

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const buildCartItem = (product, variant) => ({
    productId: product.id, variantId: variant.id, name: product.name,
    size: variant.size, price: variant.price, quantity: 1,
    itemDiscount: 0, total: variant.price, stock: variant.stock,
  });

 const addVariantToCart = useCallback((product, variant) => {
  // 🚨 guard: prevent crash
  if (!product || !variant) {
    console.warn('Invalid product/variant:', product, variant);
    showScanFeedback('error', 'Invalid product selection');
    return;
  }

  setCartItems(prev => {
    const existingIdx = prev.findIndex(i => i.variantId === variant.id);

    if (existingIdx >= 0) {
      setDuplicateModal({ product, variant, existingIdx });
      return prev;
    }

    // 🚨 safe stock check
    if ((variant.stock ?? 0) === 0) {
      showScanFeedback(
        'error',
        `Out of stock: ${product.name} (${variant.size || ''})`
      );
      return prev;
    }

    showScanFeedback(
      'success',
      `✓ ${product.name} (${variant.size || ''})`
    );

    return [...prev, buildCartItem(product, variant)];
  });
}, [showScanFeedback]);

  const handleBarcodeScanned = useCallback((barcode) => {
  const found = findByBarcodeLocal(barcode); // ✅ correct function

  if (!found || !found.product || !found.variant) {
    showScanFeedback('error', `Unknown barcode: ${barcode}`);
    return;
  }

  addVariantToCart(found.product, found.variant);
}, [addVariantToCart, showScanFeedback]);

  const handleProductSelectedFromSearch = (product) => {
  setSuggestions([]);

  if (!product?.variants || product.variants.length === 0) {
    showScanFeedback('error', 'No variants found for this product');
    return;
  }

  setSizePickerModal(product);
};

  const handleDuplicateIncreaseQty = () => {
    if (!duplicateModal) return;
    updateQuantity(duplicateModal.existingIdx, cartItems[duplicateModal.existingIdx].quantity + 1);
    showScanFeedback('success', `+1 qty: ${duplicateModal.product.name} (${duplicateModal.variant.size})`);
    setDuplicateModal(null);
  };
  const handleDuplicateNewRow = () => {
    if (!duplicateModal) return;
    const { product, variant } = duplicateModal;
    setCartItems((prev) => [...prev, { ...buildCartItem(product, variant), variantId: variant.id + '_' + Date.now() }]);
    showScanFeedback('success', `New row: ${product.name} (${variant.size})`);
    setDuplicateModal(null);
  };

  const updateQuantity = useCallback((idx, qty) => {
    setCartItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const newQty = Math.max(1, Math.min(qty, it.stock || 9999));
      return { ...it, quantity: newQty, total: it.price * newQty - (it.itemDiscount || 0) };
    }));
  }, []);

  const updateItemDiscount = useCallback((idx, disc) => {
    setCartItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const d = Math.max(0, Math.min(Number(disc || 0), it.price * it.quantity));
      return { ...it, itemDiscount: d, total: it.price * it.quantity - d };
    }));
  }, []);

  const removeItem = useCallback((idx) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Clear cart — also resets paidAmount ───────────────────────────────────
  const clearCart = useCallback(() => {
    setCartItems([]); setBillDiscount(0); setNote(''); setPaymentMode('CASH'); setPaidAmount('');
  }, []);

  // ── Complete bill ─────────────────────────────────────────────────────────
  const completeBill = async () => {
    if (!cartItems.length) return;
    setLoading(true);
    const localId    = `bill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const billNumber = generateBillNumber();
    const now        = Date.now();

    // ── Cash-change values ─────────────────────────────────────────────────
    const isCash       = paymentMode === 'CASH';
    const paidAmt      = isCash ? parseFloat(paidAmount || grandTotal) : null;
    const changeAmt    = isCash && paidAmt != null ? Math.max(0, parseFloat((paidAmt - grandTotal).toFixed(2))) : null;

    const billData = {
      localId, billNumber,
      subtotal:     parseFloat(subtotal.toFixed(2)),
      discount:     parseFloat(Number(billDiscount || 0).toFixed(2)),
      taxAmount:    parseFloat(taxResult.taxAmount.toFixed(2)),
      total:        parseFloat(grandTotal.toFixed(2)),
      paymentMode,
      note:         note || null,
      createdAt:    now,
      synced:       false,
      // ── NEW ──────────────────────────────────────────────────────────────
      paidAmount:   paidAmt,
      changeAmount: changeAmt,
      // ─────────────────────────────────────────────────────────────────────
      items: cartItems.map((it) => ({
        productId: it.productId, variantId: it.variantId, name: it.name, size: it.size,
        price: it.price, quantity: it.quantity, discount: it.itemDiscount || 0,
        total: parseFloat((it.price * it.quantity - (it.itemDiscount || 0)).toFixed(2)),
      })),
      settings: {
        storeName: settings?.storeName, gstNumber: settings?.gstNumber,
        address: settings?.address, taxType: settings?.taxType,
        taxPercent: settings?.taxPercent, cgst: settings?.cgst, sgst: settings?.sgst,
        footerMessage: settings?.footerMessage, currency: settings?.currency,
        showGST: settings?.showGST, showStoreName: settings?.showStoreName,
      },
    };

    try {
      await idbPut(STORE_LOCAL, billData);
      await idbPut(STORE_QUEUE, billData);
      setLocalBills((prev) => [billData, ...prev].slice(0, 200));
      setQueueBillIds((prev) => new Set([...prev, localId]));
      if (isOnline) {
        const token = getStoreToken();
        fetch('/api/inventory/deduct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ billId: billNumber, items: cartItems.map((it) => ({ productId: it.productId, variantId: it.variantId, quantity: it.quantity })) }),
        }).catch(console.error);
      }
      setSuccessBill(billData);
      await refreshQueueCount();
      clearCart();
      setTimeout(() => triggerSync(), 2000);
      setTimeout(async () => {
        const result = await printBillAuto(billData, settings, printerName);
        setLastPrintMethod(result.method);
      }, 400);
      if (activeTab === 'history') loadHistory(1);
    } catch (err) {
      console.error('completeBill error:', err);
      alert('Failed to save bill. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Sync ──────────────────────────────────────────────────────────────────
  const triggerSync = useCallback(() => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(runSync, 1500);
  }, []); // eslint-disable-line

  const runSync = async () => {
    if (syncing) return;
    const queue = await idbGetAll(STORE_QUEUE);
    if (!queue.length) return;
    setSyncing(true);
    try {
      const token = getStoreToken();
      const res   = await fetch('/api/store/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(queue),
      });
      if (!res.ok) throw new Error('sync failed');
      const { saved = [] } = await res.json();
      for (const { localId } of saved) {
        await idbDelete(STORE_QUEUE, localId);
        const allLocal = await idbGetAll(STORE_LOCAL);
        const bill     = allLocal.find((b) => b.localId === localId);
        if (bill) await idbPut(STORE_LOCAL, { ...bill, synced: true });
      }
      const remaining = await idbGetAll(STORE_QUEUE);
      setQueueBillIds(new Set(remaining.map((b) => b.localId)));
      idbGetAll(STORE_LOCAL).then((bills) => setLocalBills(bills.sort((a, b2) => b2.createdAt - a.createdAt)));
      await refreshQueueCount();
      if (activeTab === 'history') loadHistory(historyPage);
    } catch { syncTimerRef.current = setTimeout(runSync, 30000); }
    finally { setSyncing(false); }
  };

  const refreshQueueCount = async () => {
    const c = await idbCount(STORE_QUEUE).catch(() => 0);
    setQueueCount(c);
  };

  const mergedHistoryBills = () => {
    const dbSet         = new Set(historyBills.map((b) => b.billNumber));
    const unsyncedLocal = localBills.filter((b) => !dbSet.has(b.billNumber));
    return [
      ...unsyncedLocal.map((b) => ({ ...b, _source: 'local', _synced: !queueBillIds.has(b.localId) })),
      ...historyBills.map((b) => ({ ...b, _source: 'db', _synced: true })),
    ];
  };

  const taxLabel = settings?.taxType === 'GST_SPLIT'
    ? `GST (CGST ${settings.cgst}% + SGST ${settings.sgst}%)`
    : `Tax (${settings?.taxPercent || 0}%)`;

  const qzIndicator = ({
    connected:    { cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500',               label: 'QZ Ready'       },
    connecting:   { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400 animate-pulse', label: 'QZ Connecting…' },
    disconnected: { cls: 'bg-slate-50 text-slate-500 border-slate-200',    dot: 'bg-slate-300',               label: 'Browser Print'  },
  })[qzStatus] || { cls: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-300', label: 'Browser Print' };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shadow-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Store size={20} className="text-indigo-500" />
            <span className="font-bold text-slate-800 text-base">POS Billing</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">STORE</span>
          </div>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 ml-2">
            <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'billing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ShoppingCart size={12} /> New Bill
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <History size={12} /> History
              {localBills.length > 0 && <span className="bg-indigo-400 text-white text-[9px] px-1.5 rounded-full ml-0.5">{localBills.length}</span>}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* {!isOnline && (
            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-semibold border border-orange-200">
              ⚡ Offline — {localProducts.length} cached
            </span>
          )} */}
          <button onClick={() => setShowPrintSettings(true)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-all ${qzIndicator.cls}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${qzIndicator.dot}`} />
            {qzIndicator.label} <Settings size={11} />
          </button>
          {printerName && (
            <span className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 max-w-[120px] truncate" title={printerName}>
              <Printer size={10} /> {printerName}
            </span>
          )}
          <button onClick={runSync} disabled={syncing || queueCount === 0}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${queueCount > 0 ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {queueCount > 0 ? `${queueCount} unsynced` : 'Synced'}
          </button>
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg ${isOnline ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200">
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>

      {/* ── BILLING TAB ─────────────────────────────────────────── */}
      {activeTab === 'billing' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — search + cart */}
          <div className="flex flex-col w-full lg:w-[58%] xl:w-[62%] border-r border-slate-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 font-medium">Scan barcode <span className="text-slate-300 mx-1">or</span> type to search</p>
                {lastScanFeedback && (
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${lastScanFeedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{lastScanFeedback.message}</span>
                )}
                {/* <div className="text-[10px] text-slate-400">{localProducts.length} products cached</div> */}
              </div>
              <CombinedInput
                onScan={handleBarcodeScanned} onSearch={handleSearch}
                disabled={!!duplicateModal || !!sizePickerModal || !!showPrintSettings || activeTab !== 'billing'}
                searchResults={suggestions} onSelectProduct={handleProductSelectedFromSearch}
                searchLoading={false} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <ShoppingCart size={52} strokeWidth={1} className="text-slate-200" />
                  <div>
                    <p className="font-medium text-slate-500">Cart is empty</p>
                    <p className="text-sm text-slate-400 mt-1">Scan a barcode or search a product name</p>
                  </div>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <CartRow key={item.variantId} item={item} idx={idx} fmt={fmt}
                    editingQty={editingQty} setEditingQty={setEditingQty}
                    updateQuantity={updateQuantity} updateItemDiscount={updateItemDiscount} removeItem={removeItem} />
                ))
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="p-3 border-t border-slate-100 flex-shrink-0">
                <button onClick={clearCart} className="w-full text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Clear all items
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — summary + actions */}
          <div className="flex flex-col w-full lg:w-[42%] xl:w-[38%] bg-white overflow-y-auto">
            <div className="flex-1 p-4 space-y-4">
              {/* Bill summary */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bill Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Items ({cartItems.reduce((s, i) => s + i.quantity, 0)})</span>
                    <span className="font-medium">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Tag size={12} className="text-slate-400" />
                      <span className="text-sm text-slate-600">Bill discount</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-500">-</span>
                      <input type="number" min="0" value={billDiscount || ''} onChange={(e) => setBillDiscount(e.target.value)} placeholder="0.00"
                        className="w-24 text-right text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                    </div>
                  </div>
                  {Number(billDiscount) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>After discount</span><span className="font-medium">{fmt(discounted)}</span>
                    </div>
                  )}
                  {taxResult.taxAmount > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{taxLabel}</span><span>+{fmt(taxResult.taxAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 flex justify-between">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="font-bold text-xl text-slate-900">{fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment mode */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment Mode</h3>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_MODES.map((pm) => (
                    <button key={pm.id} onClick={() => { setPaymentMode(pm.id); setPaidAmount(''); }}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-xs font-medium ${paymentMode === pm.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                      <pm.icon size={18} /> {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── CASH CHANGE SECTION ─────────────────────────────────────── */}
              {paymentMode === 'CASH' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote size={13} /> Cash Payment
                  </h3>

                  {/* Customer paid input */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700 font-medium">Customer Paid</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-sm font-medium">₹</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
                        className="w-28 text-right text-sm font-semibold border-2 border-green-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                      />
                    </div>
                  </div>

                  {/* Change to return */}
                  {parseFloat(paidAmount) >= grandTotal && grandTotal > 0 && (
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-green-300">
                      <span className="text-sm font-semibold text-green-700">Change to Return</span>
                      <span className="text-base font-bold text-green-700">{fmt(changeAmount)}</span>
                    </div>
                  )}

                  {/* Under-paid warning */}
                  {parseFloat(paidAmount) > 0 && parseFloat(paidAmount) < grandTotal && (
                    <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2.5 border border-red-200">
                      <span className="text-sm text-red-600 font-medium">Still Owed</span>
                      <span className="text-sm font-bold text-red-600">{fmt(grandTotal - parseFloat(paidAmount))}</span>
                    </div>
                  )}
                </div>
              )}
              {/* ── END CASH CHANGE ─────────────────────────────────────────── */}

              {/* Note */}
              {/* <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Note</h3>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer name, phone, or any note…" rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 resize-none placeholder:text-slate-400" />
              </div> */}

              {/* Print indicator */}
              {/* <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${qzStatus === 'connected' && printerName ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <Printer size={13} />
                {qzStatus === 'connected' && printerName ? (
                  <><span className="font-medium">Direct print:</span> {printerName}</>
                ) : (
                  <><span>Browser print dialog</span><button onClick={() => setShowPrintSettings(true)} className="ml-auto underline hover:text-blue-600">Set printer</button></>
                )}
              </div> */}
            </div>

            {/* Complete bill button — always visible, fixed at bottom of right panel */}
            <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-white">
              <button onClick={completeBill} disabled={!cartItems.length || loading}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg ${cartItems.length && !loading ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 hover:shadow-xl active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
                {loading
                  ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><CheckCircle size={20} /> Complete Bill · {fmt(grandTotal)}</>
                }
              </button>
              {/* Cash change summary below button */}
              {paymentMode === 'CASH' && parseFloat(paidAmount) >= grandTotal && grandTotal > 0 && (
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-slate-500">Paid {fmt(parseFloat(paidAmount))}</span>
                  <span className="text-xs font-semibold text-green-600">Change {fmt(changeAmount)}</span>
                </div>
              )}
              {/* <p className="text-center text-xs text-slate-400 mt-1.5">
                {qzStatus === 'connected' && printerName ? '⚡ Prints directly to thermal printer' : isOnline ? 'Saves & syncs instantly' : '⚡ Saves offline · Syncs when online'}
              </p> */}
            </div>
          </div>
        </div>
      ) : (
        /* ── HISTORY TAB ── */
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
          <div className="bg-white border-b border-slate-200 px-5 py-4 flex-shrink-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                <TrendingUp size={16} className="text-indigo-600" />
                <div>
                  <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-wide">Today's Revenue</p>
                  <p className="text-base font-bold text-indigo-700">{fmt(todayStats.revenue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <Receipt size={16} className="text-slate-600" />
                <div>
                  <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wide">Today's Bills</p>
                  <p className="text-base font-bold text-slate-700">{todayStats.count}</p>
                </div>
              </div>
              {queueCount > 0 && (
                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
                  <AlertTriangle size={16} className="text-orange-600" />
                  <div>
                    <p className="text-[10px] text-orange-600 font-medium uppercase tracking-wide">Unsynced</p>
                    <p className="text-base font-bold text-orange-700">{queueCount}</p>
                  </div>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => loadHistory(1)} disabled={historyLoading}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200">
                  <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                </button>
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                  <Filter size={12} /> Filters <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search bills by number, note…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide block mb-1">Payment Mode</label>
                  <select value={historyPM} onChange={(e) => setHistoryPM(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">All modes</option>
                    {PAYMENT_MODES.map((pm) => <option key={pm.id} value={pm.id}>{pm.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide block mb-1">From Date</label>
                  <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide block mb-1">To Date</label>
                  <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setHistorySearch(''); setHistoryPM(''); setHistoryDateFrom(''); setHistoryDateTo(''); }}
                    className="w-full text-sm text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {historyLoading && historyBills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading bills…</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {mergedHistoryBills().map((bill) => {
                    const isSynced   = bill._synced !== false;
                    const isExpanded = expandedBill === (bill.id || bill.localId);
                    const createdAt  = bill.createdAt instanceof Date ? bill.createdAt : new Date(bill.createdAt);
                    return (
                      <div key={bill.id || bill.localId} className={`bg-white rounded-xl border transition-all ${isExpanded ? 'border-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-3 p-3.5">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isSynced ? 'bg-green-400' : 'bg-orange-400 animate-pulse'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-slate-800">{bill.billNumber}</p>
                              {!isSynced && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">OFFLINE</span>}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PM_COLORS[bill.paymentMode] || PM_COLORS.OTHER}`}>{bill.paymentMode}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-xs text-slate-400">{createdAt.toLocaleString('en-IN')}</p>
                              <span className="text-xs text-slate-400">{bill.items?.length || 0} item(s)</span>
                              {bill.note && <span className="text-xs text-slate-400 truncate max-w-[120px]">"{bill.note}"</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-slate-800 text-sm">{fmt(bill.total)}</p>
                              {/* Show paid/change inline in history */}
                              {bill.paymentMode === 'CASH' && bill.paidAmount != null && (
                                <p className="text-[10px] text-green-600 font-medium">Change {fmt(bill.changeAmount || 0)}</p>
                              )}
                            </div>
                            <button onClick={() => printBillAuto(bill, settings, printerName)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Printer size={14} /></button>
                            <button onClick={() => setExpandedBill(isExpanded ? null : bill.id || bill.localId)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Eye size={14} /></button>
                          </div>
                        </div>
                        {isExpanded && bill.items?.length > 0 && (
                          <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                            <div className="bg-slate-50 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Item</th>
                                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Size</th>
                                    <th className="text-center py-2 px-3 text-slate-500 font-medium">Qty</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Price</th>
                                    <th className="text-right py-2 px-3 text-slate-500 font-medium">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((item, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                      <td className="py-2 px-3 text-slate-700 font-medium">{item.name}</td>
                                      <td className="py-2 px-3">{item.size ? <span className="inline-flex items-center justify-center w-8 h-6 bg-indigo-600 text-white rounded text-xs font-bold">{item.size}</span> : '—'}</td>
                                      <td className="py-2 px-3 text-center text-slate-600">{item.quantity}</td>
                                      <td className="py-2 px-3 text-right text-slate-600">{fmt(item.price)}</td>
                                      <td className="py-2 px-3 text-right font-medium text-slate-800">{fmt(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="border-t border-slate-200">
                                  {bill.discount > 0 && <tr><td colSpan={4} className="py-1.5 px-3 text-slate-500 text-right">Discount</td><td className="py-1.5 px-3 text-right text-green-600">-{fmt(bill.discount)}</td></tr>}
                                  {bill.taxAmount > 0 && <tr><td colSpan={4} className="py-1.5 px-3 text-slate-500 text-right">Tax</td><td className="py-1.5 px-3 text-right text-slate-600">+{fmt(bill.taxAmount)}</td></tr>}
                                  <tr><td colSpan={4} className="py-2 px-3 text-right font-bold text-slate-700">Grand Total</td><td className="py-2 px-3 text-right font-bold text-indigo-600">{fmt(bill.total)}</td></tr>
                                  {/* Cash change in expanded view */}
                                  {bill.paymentMode === 'CASH' && bill.paidAmount != null && (
                                    <>
                                      <tr><td colSpan={4} className="py-1.5 px-3 text-right text-green-700">Paid</td><td className="py-1.5 px-3 text-right text-green-700 font-semibold">{fmt(bill.paidAmount)}</td></tr>
                                      <tr><td colSpan={4} className="py-1.5 px-3 text-right text-green-700 font-bold">Change</td><td className="py-1.5 px-3 text-right text-green-700 font-bold">{fmt(bill.changeAmount || 0)}</td></tr>
                                    </>
                                  )}
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {mergedHistoryBills().length === 0 && !historyLoading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                      <Receipt size={40} strokeWidth={1} />
                      <p className="text-sm font-medium">No bills found</p>
                      <p className="text-xs">Bills you create will appear here</p>
                    </div>
                  )}
                </div>
                {historyTotal > 50 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button onClick={() => loadHistory(historyPage - 1)} disabled={historyPage <= 1 || historyLoading} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                    <span className="text-sm text-slate-500">Page {historyPage} · {historyTotal} total</span>
                    <button onClick={() => loadHistory(historyPage + 1)} disabled={historyPage * 50 >= historyTotal || historyLoading} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SUCCESS TOAST ─────────────────────────────────────── */}
      {successBill && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium">
          <CheckCircle size={18} />
          <div className="flex flex-col">
            <span>Bill {successBill.billNumber} saved!</span>
            {successBill.paymentMode === 'CASH' && successBill.changeAmount > 0 && (
              <span className="text-[11px] text-indigo-200 mt-0.5">Change: {fmt(successBill.changeAmount)}</span>
            )}
            {lastPrintMethod && (
              <span className="text-[10px] text-indigo-200 mt-0.5">{lastPrintMethod === 'qz' ? '🖨 Printed via QZ Tray' : '🌐 Opened browser print'}</span>
            )}
          </div>
          <button onClick={() => printBillAuto(successBill, settings, printerName)} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-xs"><Printer size={12} /> Reprint</button>
          <button onClick={() => setSuccessBill(null)} className="ml-1 hover:text-white/70"><X size={14} /></button>
        </div>
      )}

      {/* ── DUPLICATE MODAL ───────────────────────────────────── */}
      {duplicateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle size={20} className="text-amber-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800">Already in cart</h3>
                <p className="text-sm text-slate-500">{duplicateModal.product.name} <span className="font-semibold text-indigo-600">({duplicateModal.variant.size})</span></p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={handleDuplicateIncreaseQty} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm">
                + Increase qty (→ {cartItems[duplicateModal.existingIdx]?.quantity + 1})
              </button>
              <button onClick={handleDuplicateNewRow} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm">Add as new line</button>
              <button onClick={() => setDuplicateModal(null)} className="w-full py-2.5 text-slate-400 hover:text-slate-600 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIZE PICKER MODAL ──────────────────────────────────── */}
      {/* ── SIZE PICKER MODAL ──────────────────────────────────── */}
{sizePickerModal && (
  <SizePickerModal
    product={sizePickerModal}
    onConfirm={(product, variants) => {
      if (!Array.isArray(variants) || variants.length === 0) return;

      // ✅ Add all selected variants safely
      variants.forEach((variant) => {
        if (variant) {
          addVariantToCart(product, variant);
        }
      });

      // ✅ Close AFTER processing
      setSizePickerModal(null);
    }}
    onClose={() => setSizePickerModal(null)}
  />
)}

      {/* ── PRINT SETTINGS MODAL ─────────────────────────────── */}
      {showPrintSettings && (
        <PrintSettingsModal onClose={() => setShowPrintSettings(false)} printerName={printerName} onPrinterChange={handlePrinterChange} qzStatus={qzStatus} />
      )}
    </div>
  );
}