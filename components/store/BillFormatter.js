/**
 * components/store/BillFormatter.js
 * ─────────────────────────────────────────────────────────────
 * Bill formatting utilities for thermal printer output
 *
 * Provides:
 * - formatBillText()     → plain text for preview / fallback
 * - formatForESCPOS()    → raw ESC/POS string (used by PrintService)
 * - formatBillHTML()     → HTML for browser print fallback
 * ─────────────────────────────────────────────────────────────
 */

const PAPER_COLS = 48; // 80mm @ 12cpi monospace

/**
 * Pad / truncate a string to exact width
 */
export function pad(str, width, align = 'left') {
  const s = String(str ?? '').slice(0, width);
  if (align === 'right') return s.padStart(width);
  if (align === 'center') {
    const total = width - s.length;
    const left = Math.floor(total / 2);
    return ' '.repeat(left) + s + ' '.repeat(total - left);
  }
  return s.padEnd(width);
}

/**
 * Two-column line: left text + right-aligned value
 */
export function twoCol(label, value, cols = PAPER_COLS) {
  const v = String(value);
  const maxLabel = cols - v.length - 1;
  return String(label).slice(0, maxLabel).padEnd(maxLabel) + ' ' + v;
}

/**
 * Centered text
 */
export function centerText(text, cols = PAPER_COLS) {
  const t = String(text).slice(0, cols);
  const spaces = Math.max(0, Math.floor((cols - t.length) / 2));
  return ' '.repeat(spaces) + t;
}

/**
 * Divider line
 */
export function divider(char = '-', cols = PAPER_COLS) {
  return char.repeat(cols);
}

/**
 * Format currency
 */
export function fmtCurrency(amount, currency = 'INR') {
  const n = parseFloat(amount || 0);
  if (currency === 'INR') return `Rs.${n.toFixed(2)}`;
  return `${currency} ${n.toFixed(2)}`;
}

/**
 * Format date for receipt
 */
export function fmtReceiptDate(ts) {
  return new Date(ts || Date.now()).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate plain text bill (for preview, logging, fallback)
 *
 * @param {object} bill
 * @param {object} settings
 * @returns {string}
 */
export function formatBillText(bill, settings = {}) {
  const s = { ...settings, ...(bill.settings || {}) };
  const currency = s.currency || 'INR';
  const fmt = (n) => fmtCurrency(n, currency);
  const W = PAPER_COLS;

  const lines = [];

  const add = (text = '') => lines.push(text);
  const addC = (text) => add(centerText(text, W));
  const addDiv = (char = '-') => add(divider(char, W));
  const addLine = (label, value) => add(twoCol(label, value, W));

  // Header
  addDiv();
  if (s.showStoreName !== false && s.storeName) {
    addC(s.storeName.toUpperCase());
  }
  if (s.address) addC(s.address);
  if (s.showGST && s.gstNumber) addC('GST: ' + s.gstNumber);
  addDiv();

  // Bill info
  add('Bill No : ' + bill.billNumber);
  add('Date    : ' + fmtReceiptDate(bill.createdAt));
  add('Payment : ' + bill.paymentMode);
  if (bill.note) add('Note    : ' + String(bill.note).slice(0, 36));
  addDiv();

  // Items header
  // 20 + 4 + 8 + 8 + space = 40... adjust to 48
  add(pad('Item', 22) + pad('Qty', 4) + pad('Price', 10, 'right') + pad('Total', 10, 'right'));
  addDiv();

  // Items
  (bill.items || []).forEach((item) => {
    const name = pad(item.name, 22);
    const qty = pad(String(item.quantity), 4);
    const price = pad(fmt(item.price), 10, 'right');
    const total = pad(fmt(item.total), 10, 'right');
    add(name + qty + price + total);

    // Second line for long names
    if (item.name.length > 22) {
      add('  ' + item.name.slice(22, 46));
    }
  });

  addDiv();

  // Totals
  addLine('Subtotal:', fmt(bill.subtotal));

  if (parseFloat(bill.discount) > 0) {
    addLine('Discount:', '-' + fmt(bill.discount));
  }

  if (parseFloat(bill.taxAmount) > 0) {
    if (s.taxType === 'GST_SPLIT') {
      addLine(`CGST (${s.cgst}%):`, fmt(bill.taxAmount / 2));
      addLine(`SGST (${s.sgst}%):`, fmt(bill.taxAmount / 2));
    } else {
      addLine(`Tax (${s.taxPercent || 0}%):`, fmt(bill.taxAmount));
    }
  }

  addDiv('=');
  addLine('TOTAL:', fmt(bill.total));
  addDiv('=');

  // Footer
  add('');
  addC(s.footerMessage || 'Thank You! Visit Again');
  add('');
  addDiv();

  return lines.join('\n');
}

/**
 * Generate item table rows for HTML bill
 */
function buildHTMLItems(items, fmtN) {
  return (items || [])
    .map(
      (it) => `
    <tr>
      <td class="item-name">${escapeHtml(it.name)}</td>
      <td class="item-qty">${it.quantity}</td>
      <td class="item-price">${fmtN(it.price)}</td>
      <td class="item-total">${fmtN(it.total)}</td>
    </tr>`
    )
    .join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generate full HTML bill for browser print / preview
 *
 * @param {object} bill
 * @param {object} settings
 * @returns {string} Full HTML document string
 */
export function formatBillHTML(bill, settings = {}) {
  const s = { ...settings, ...(bill.settings || {}) };
  const currency = s.currency || 'INR';
  const fmtN = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(parseFloat(n || 0));

  const dateStr = fmtReceiptDate(bill.createdAt);
  const itemRows = buildHTMLItems(bill.items, fmtN);

  let taxRows = '';
  if (s.taxType === 'GST_SPLIT' && parseFloat(bill.taxAmount) > 0) {
    taxRows = `
      <tr class="summary-row">
        <td colspan="3">CGST (${s.cgst}%)</td>
        <td>${fmtN(bill.taxAmount / 2)}</td>
      </tr>
      <tr class="summary-row">
        <td colspan="3">SGST (${s.sgst}%)</td>
        <td>${fmtN(bill.taxAmount / 2)}</td>
      </tr>`;
  } else if (parseFloat(bill.taxAmount) > 0) {
    taxRows = `
      <tr class="summary-row">
        <td colspan="3">Tax (${s.taxPercent || 0}%)</td>
        <td>${fmtN(bill.taxAmount)}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(bill.billNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      max-width: 302px;
      margin: 0 auto;
      padding: 6px 4px;
      color: #111;
    }
    .store-name {
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .store-meta {
      text-align: center;
      font-size: 10px;
      color: #444;
      margin: 1px 0;
    }
    .divider {
      border: none;
      border-top: 1px dashed #aaa;
      margin: 5px 0;
    }
    .divider-solid {
      border: none;
      border-top: 2px solid #111;
      margin: 5px 0;
    }
    .bill-meta { font-size: 11px; margin: 2px 0; }
    .bill-meta strong { font-size: 12px; }

    table { width: 100%; border-collapse: collapse; }

    thead th {
      font-size: 10px;
      text-align: left;
      border-bottom: 1px solid #aaa;
      padding: 3px 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td { padding: 3px 2px; font-size: 11px; vertical-align: top; }
    .item-name { max-width: 120px; word-break: break-word; }
    .item-qty  { text-align: center; white-space: nowrap; }
    .item-price, .item-total { text-align: right; white-space: nowrap; }

    tbody tr:not(:last-child) td { border-bottom: 1px dotted #ddd; }

    .summary-row td { border: none; padding: 2px 2px; font-size: 11px; }
    .summary-row td:first-child { text-align: left; }
    .summary-row td:last-child { text-align: right; }

    .discount-row td { color: #c00; }

    .total-row td {
      font-size: 15px;
      font-weight: bold;
      padding-top: 6px;
      border-top: 2px solid #111;
    }
    .total-row td:first-child { text-align: left; }
    .total-row td:last-child { text-align: right; }

    .footer {
      text-align: center;
      font-size: 10px;
      color: #666;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #aaa;
    }

    @media print {
      body { max-width: 100%; }
      @page { margin: 2mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  ${s.showStoreName !== false && s.storeName ? `<div class="store-name">${escapeHtml(s.storeName)}</div>` : ''}
  ${s.address ? `<div class="store-meta">${escapeHtml(s.address)}</div>` : ''}
  ${s.showGST && s.gstNumber ? `<div class="store-meta">GST: ${escapeHtml(s.gstNumber)}</div>` : ''}

  <hr class="divider">

  <div class="bill-meta"><strong>${escapeHtml(bill.billNumber)}</strong></div>
  <div class="bill-meta">${dateStr}</div>
  <div class="bill-meta">Payment: <strong>${escapeHtml(bill.paymentMode)}</strong></div>
  ${bill.note ? `<div class="bill-meta">Note: ${escapeHtml(bill.note)}</div>` : ''}

  <hr class="divider">

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr class="summary-row">
        <td colspan="3">Subtotal</td>
        <td>${fmtN(bill.subtotal)}</td>
      </tr>
      ${parseFloat(bill.discount) > 0
        ? `<tr class="summary-row discount-row">
             <td colspan="3">Discount</td>
             <td>-${fmtN(bill.discount)}</td>
           </tr>`
        : ''}
      ${taxRows}
      <tr class="total-row">
        <td colspan="3">TOTAL</td>
        <td>${fmtN(bill.total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    ${s.footerMessage ? escapeHtml(s.footerMessage) : 'Thank You! Visit Again'}
  </div>
</body>
</html>`;
}

/**
 * Quick bill summary string (for toasts, logs)
 */
export function formatBillSummary(bill, settings = {}) {
  const currency = settings?.currency || bill.settings?.currency || 'INR';
  const fmt = (n) => fmtCurrency(n, currency);
  return `${bill.billNumber} · ${(bill.items || []).length} item(s) · ${fmt(bill.total)} · ${bill.paymentMode}`;
}