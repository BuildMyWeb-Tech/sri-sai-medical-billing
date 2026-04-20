/**
 * components/store/PrintService.js
 * ─────────────────────────────────────────────────────────────
 * QZ Tray connection + direct thermal print service
 *
 * ✅ Direct USB thermal print (no browser dialog)
 * ✅ ESC/POS commands for 80mm paper
 * ✅ Auto-connect with retry
 * ✅ Fallback to browser print if QZ Tray not running
 * ✅ Reprint support
 * ✅ Works with TVS and all standard thermal printers
 * ─────────────────────────────────────────────────────────────
 *
 * SETUP:
 * 1. npm install qz-tray
 * 2. Download & install QZ Tray from https://qz.io/download/
 * 3. Run QZ Tray on Windows (system tray)
 * 4. Set PRINTER_NAME below to your exact Windows printer name
 */

// ─── ESC/POS Constants ────────────────────────────────────────
const ESC = '\x1B';
const GS  = '\x1D';

const CMD = {
  INIT:           ESC + '@',          // Initialize printer
  ALIGN_LEFT:     ESC + 'a\x00',
  ALIGN_CENTER:   ESC + 'a\x01',
  ALIGN_RIGHT:    ESC + 'a\x02',
  BOLD_ON:        ESC + 'E\x01',
  BOLD_OFF:       ESC + 'E\x00',
  DOUBLE_HEIGHT:  GS  + '!\x11',     // Double height + width
  NORMAL_SIZE:    GS  + '!\x00',
  UNDERLINE_ON:   ESC + '-\x01',
  UNDERLINE_OFF:  ESC + '-\x00',
  CUT:            GS  + 'V\x41\x00', // Full cut with feed
  FEED_3:         ESC + 'd\x03',     // Feed 3 lines
  FEED_1:         ESC + 'd\x01',
  LINE_SPACING:   ESC + '3\x20',     // Tight line spacing
};

// ─── Config ───────────────────────────────────────────────────
// Set this to your exact printer name from Windows "Devices and Printers"
const DEFAULT_PRINTER_NAME = 'TVS MSP 250 STAR';
const PAPER_COLS = 48; // 80mm paper = ~48 chars for monospace

// ─── QZ Tray State ────────────────────────────────────────────
let qzInstance = null;
let qzConnecting = false;
let qzConnected = false;

/**
 * Dynamically load QZ Tray script
 * (avoids SSR issues in Next.js)
 */
async function loadQZ() {
  if (typeof window === 'undefined') return null;
  if (qzInstance) return qzInstance;

  // Try to import qz-tray npm package
  try {
    const mod = await import('qz-tray');
    qzInstance = mod.default || mod;
    return qzInstance;
  } catch (_) {}

  // Fallback: load from CDN
  return new Promise((resolve) => {
    if (window.qz) {
      qzInstance = window.qz;
      resolve(qzInstance);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.onload = () => {
      qzInstance = window.qz;
      resolve(qzInstance);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Connect to QZ Tray WebSocket
 * Returns { success, error }
 */
export async function connectQZ() {
  if (qzConnected) return { success: true };
  if (qzConnecting) {
    // Wait for existing connection attempt
    await new Promise((r) => setTimeout(r, 2000));
    return qzConnected ? { success: true } : { success: false, error: 'Connection timeout' };
  }

  qzConnecting = true;
  try {
    const qz = await loadQZ();
    if (!qz) throw new Error('QZ Tray library not available');

    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 2, delay: 1 });
    }

    qzConnected = true;
    qzConnecting = false;

    // Handle disconnect
    qz.websocket.setClosedCallbacks(() => {
      qzConnected = false;
    });

    return { success: true };
  } catch (err) {
    qzConnecting = false;
    qzConnected = false;
    return { success: false, error: err.message || 'QZ Tray not running' };
  }
}

/**
 * Disconnect from QZ Tray
 */
export async function disconnectQZ() {
  try {
    const qz = await loadQZ();
    if (qz && qz.websocket.isActive()) {
      await qz.websocket.disconnect();
    }
  } catch (_) {}
  qzConnected = false;
}

/**
 * Get list of available printers
 * Returns string[] of printer names
 */
export async function getAvailablePrinters() {
  const conn = await connectQZ();
  if (!conn.success) return [];
  try {
    const qz = await loadQZ();
    return await qz.printers.find();
  } catch {
    return [];
  }
}

/**
 * Check if QZ Tray is running
 */
export async function isQZAvailable() {
  try {
    const qz = await loadQZ();
    if (!qz) return false;
    if (qz.websocket.isActive()) return true;
    const result = await connectQZ();
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Core print function using QZ Tray
 * @param {string[]} rawData - Array of ESC/POS strings
 * @param {string} printerName - Printer name (from Windows)
 * @returns {{ success: boolean, error?: string }}
 */
export async function printRaw(rawData, printerName = DEFAULT_PRINTER_NAME) {
  const conn = await connectQZ();
  if (!conn.success) {
    return { success: false, error: conn.error };
  }

  try {
    const qz = await loadQZ();
    const config = qz.configs.create(printerName, {
      encoding: 'Cp1252',
      copies: 1,
    });

    const printData = rawData.map((d) => ({
      type: 'raw',
      format: 'plain',
      data: d,
    }));

    await qz.print(config, printData);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main entry point: Print a bill
 * Tries QZ Tray first → fallback to browser print
 *
 * @param {object} bill - Bill data object
 * @param {object} settings - Store settings
 * @param {string} printerName - Printer name override
 * @returns {{ method: 'qz'|'browser'|'failed', success: boolean, error?: string }}
 */
export async function printBillThermal(bill, settings = {}, printerName = DEFAULT_PRINTER_NAME) {
  // 1. Try QZ Tray (direct thermal)
  const qzAvailable = await isQZAvailable();

  if (qzAvailable) {
    const escData = buildESCPOS(bill, settings);
    const result = await printRaw([escData], printerName);
    if (result.success) {
      return { method: 'qz', success: true };
    }
    // QZ connected but print failed → fall through to browser
    console.warn('QZ print failed, falling back to browser:', result.error);
  }

  // 2. Fallback: browser print window
  try {
    browserPrintFallback(bill, settings);
    return { method: 'browser', success: true };
  } catch (err) {
    return { method: 'failed', success: false, error: err.message };
  }
}

/**
 * Build ESC/POS string from bill data
 */
function buildESCPOS(bill, settings = {}) {
  const s = { ...settings, ...(bill.settings || {}) };
  const currency = s.currency || 'INR';
  const W = PAPER_COLS;

  const fmtMoney = (n) => {
    const num = parseFloat(n || 0);
    if (currency === 'INR') return `Rs.${num.toFixed(2)}`;
    return `${currency} ${num.toFixed(2)}`;
  };

  const center = (text) => {
    const t = String(text).slice(0, W);
    const pad = Math.max(0, Math.floor((W - t.length) / 2));
    return ' '.repeat(pad) + t;
  };

  const line = (left, right) => {
    const r = String(right);
    const maxLeft = W - r.length - 1;
    const l = String(left).slice(0, maxLeft).padEnd(maxLeft);
    return l + ' ' + r;
  };

  const divider = (char = '-') => char.repeat(W);

  const dateStr = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  let out = '';

  // Init
  out += CMD.INIT;
  out += CMD.LINE_SPACING;

  // ── Store Header ──
  out += CMD.ALIGN_CENTER;
  if (s.showStoreName !== false && s.storeName) {
    out += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT;
    out += s.storeName + '\n';
    out += CMD.NORMAL_SIZE + CMD.BOLD_OFF;
  }
  if (s.address) {
    out += s.address + '\n';
  }
  if (s.showGST && s.gstNumber) {
    out += 'GST: ' + s.gstNumber + '\n';
  }
  out += '\n';

  // ── Bill Info ──
  out += CMD.ALIGN_LEFT;
  out += divider() + '\n';
  out += CMD.BOLD_ON;
  out += 'Bill No: ' + bill.billNumber + '\n';
  out += CMD.BOLD_OFF;
  out += 'Date   : ' + dateStr + '\n';
  out += 'Payment: ' + bill.paymentMode + '\n';
  if (bill.note) {
    out += 'Note   : ' + String(bill.note).slice(0, 36) + '\n';
  }
  out += divider() + '\n';

  // ── Items Header ──
  out += CMD.BOLD_ON;
  // Name(20) Qty(4) Price(10) Total(10) — adjusted for 48 cols
  out += 'Item                Qty  Price   Total\n';
  out += CMD.BOLD_OFF;
  out += divider() + '\n';

  // ── Items ──
  (bill.items || []).forEach((item) => {
    const name = String(item.name).slice(0, 20).padEnd(20);
    const qty  = String(item.quantity).padStart(3).padEnd(4);
    const price = fmtMoney(item.price).padStart(7);
    const total = fmtMoney(item.total).padStart(8);
    out += name + qty + price + total + '\n';

    // Long name overflow to second line
    if (item.name.length > 20) {
      out += '  ' + item.name.slice(20, 44) + '\n';
    }
  });

  out += divider() + '\n';

  // ── Totals ──
  out += line('Subtotal:', fmtMoney(bill.subtotal)) + '\n';

  if (parseFloat(bill.discount) > 0) {
    out += CMD.BOLD_ON;
    out += line('Discount:', '-' + fmtMoney(bill.discount)) + '\n';
    out += CMD.BOLD_OFF;
  }

  if (parseFloat(bill.taxAmount) > 0) {
    if (s.taxType === 'GST_SPLIT') {
      out += line(`CGST (${s.cgst}%):`, fmtMoney(bill.taxAmount / 2)) + '\n';
      out += line(`SGST (${s.sgst}%):`, fmtMoney(bill.taxAmount / 2)) + '\n';
    } else {
      out += line(`Tax (${s.taxPercent || 0}%):`, fmtMoney(bill.taxAmount)) + '\n';
    }
  }

  out += divider('=') + '\n';
  out += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT;
  out += CMD.ALIGN_CENTER;
  out += 'TOTAL: ' + fmtMoney(bill.total) + '\n';
  out += CMD.NORMAL_SIZE + CMD.BOLD_OFF;

  // ── Footer ──
  out += CMD.ALIGN_CENTER;
  out += divider() + '\n';
  if (s.footerMessage) {
    out += s.footerMessage + '\n';
  } else {
    out += 'Thank You! Visit Again\n';
  }
  out += '\n';

  // Feed + Cut
  out += CMD.FEED_3;
  out += CMD.CUT;

  return out;
}

/**
 * Browser print fallback (opens new window with styled bill)
 */
export function browserPrintFallback(bill, settings = {}) {
  const s = { ...settings, ...(bill.settings || {}) };
  const currency = s.currency || 'INR';

  const fmtN = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(parseFloat(n || 0));

  const dateStr = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN');

  const itemRows = (bill.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${fmtN(it.price)}</td>
        <td style="text-align:right">${fmtN(it.total)}</td>
      </tr>`
    )
    .join('');

  let taxRows = '';
  if (s.taxType === 'GST_SPLIT' && parseFloat(bill.taxAmount) > 0) {
    taxRows = `
      <tr><td colspan="3">CGST (${s.cgst}%)</td><td style="text-align:right">${fmtN(bill.taxAmount / 2)}</td></tr>
      <tr><td colspan="3">SGST (${s.sgst}%)</td><td style="text-align:right">${fmtN(bill.taxAmount / 2)}</td></tr>`;
  } else if (parseFloat(bill.taxAmount) > 0) {
    taxRows = `<tr><td colspan="3">Tax (${s.taxPercent || 0}%)</td><td style="text-align:right">${fmtN(bill.taxAmount)}</td></tr>`;
  }

  const html = `<!DOCTYPE html><html><head><title>${bill.billNumber}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 8px; }
      h2 { text-align: center; font-size: 15px; margin: 4px 0; }
      .center { text-align: center; }
      .meta { text-align: center; font-size: 11px; color: #555; margin: 2px 0; }
      .divider { border-top: 1px dashed #999; margin: 6px 0; }
      .divider-solid { border-top: 2px solid #333; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      th { font-size: 11px; border-bottom: 1px solid #ccc; padding: 3px 2px; text-align: left; }
      td { padding: 3px 2px; font-size: 11px; border-bottom: 1px dotted #eee; vertical-align: top; }
      .total-row td { font-weight: bold; font-size: 14px; border-top: 2px solid #333; border-bottom: none; padding-top: 6px; }
      .subtotal td { border-bottom: none; border-top: 1px dashed #ccc; }
      .footer { text-align: center; margin-top: 10px; font-size: 11px; color: #777; }
      @media print {
        body { max-width: 100%; }
        @page { margin: 2mm; }
      }
    </style></head><body>
    ${s.showStoreName !== false && s.storeName ? `<h2>${s.storeName}</h2>` : ''}
    ${s.address ? `<p class="meta">${s.address}</p>` : ''}
    ${s.showGST && s.gstNumber ? `<p class="meta">GST: ${s.gstNumber}</p>` : ''}
    <div class="divider"></div>
    <p class="meta"><strong>${bill.billNumber}</strong></p>
    <p class="meta">${dateStr}</p>
    <p class="meta">Payment: <strong>${bill.paymentMode}</strong></p>
    ${bill.note ? `<p class="meta">Note: ${bill.note}</p>` : ''}
    <div class="divider"></div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr class="subtotal"><td colspan="3">Subtotal</td><td style="text-align:right">${fmtN(bill.subtotal)}</td></tr>
        ${parseFloat(bill.discount) > 0 ? `<tr><td colspan="3">Discount</td><td style="text-align:right">-${fmtN(bill.discount)}</td></tr>` : ''}
        ${taxRows}
        <tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right">${fmtN(bill.total)}</td></tr>
      </tfoot>
    </table>
    ${s.footerMessage ? `<div class="footer">${s.footerMessage}</div>` : '<div class="footer">Thank You! Visit Again</div>'}
    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=380,height=620');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}