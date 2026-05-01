/**
 * components/store/PrintService.js
 * FULL OPTIMIZED VERSION (Compact + Sharp Print)
 */

const ESC = '\x1B';
const GS  = '\x1D';

const CMD = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_RIGHT: ESC + 'a\x02',
  BOLD_ON: ESC + 'E\x01',
  BOLD_OFF: ESC + 'E\x00',
  DOUBLE_HEIGHT: GS + '!\x11',
  NORMAL_SIZE: GS + '!\x00',
  CUT: GS + 'V\x41\x00',
  FEED_1: ESC + 'd\x01',
  LINE_SPACING: ESC + '3\x18'
};

const DEFAULT_PRINTER_NAME = 'TVS RP3160 GOLD';
const PAPER_COLS = 48;

let qzInstance = null;
let qzConnected = false;

// ─── LOAD QZ ───
async function loadQZ() {
  if (typeof window === 'undefined') return null;
  if (qzInstance) return qzInstance;

  try {
    const mod = await import('qz-tray');
    qzInstance = mod.default || mod;
  } catch {}

  if (!qzInstance) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
      script.onload = () => { qzInstance = window.qz; resolve(); };
      document.head.appendChild(script);
    });
  }

  if (qzInstance) {
    qzInstance.security.setCertificatePromise(r => r(''));
    qzInstance.security.setSignaturePromise(() => r => r(''));
  }

  return qzInstance;
}

// ─── CONNECT ───
export async function connectQZ() {
  try {
    const qz = await loadQZ();
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }
    qzConnected = true;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── PRINT RAW ───
export async function printRaw(data, printer = DEFAULT_PRINTER_NAME) {
  const conn = await connectQZ();
  if (!conn.success) return conn;

  try {
    const qz = await loadQZ();
    const config = qz.configs.create(printer);

    await qz.print(config, data.map(d => ({
      type: 'raw',
      format: 'plain',
      data: d
    })));

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── MAIN PRINT ───
export async function printBillThermal(bill, settings = {}) {
  try {
    const esc = buildESCPOS(bill, settings);
    const res = await printRaw([esc]);

    if (res.success) return { method: 'qz', success: true };

    browserPrintFallback(bill, settings);
    return { method: 'browser', success: true };

  } catch (e) {
    return { method: 'failed', success: false };
  }
}

// ─── ESC/POS BUILDER ───
function buildESCPOS(bill, s = {}) {
  const W = PAPER_COLS;

  const money = (n) => `Rs.${parseFloat(n || 0).toFixed(2)}`;

  const line = (l, r) => {
    r = String(r);
    const left = String(l).padEnd(W - r.length - 1);
    return left + ' ' + r;
  };

  const div = () => '-'.repeat(W);

  let out = '';

  out += CMD.INIT;
  out += CMD.LINE_SPACING;

  // HEADER
  out += CMD.ALIGN_CENTER;
  out += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT;
  out += (s.storeName || '') + '\n';
  out += CMD.NORMAL_SIZE + CMD.BOLD_OFF;

  if (s.address) out += s.address + '\n';
  if (s.gstNumber) out += 'GST: ' + s.gstNumber + '\n';

  out += div() + '\n';

  // META
  out += CMD.ALIGN_LEFT;
  out += CMD.BOLD_ON + 'Bill: ' + bill.billNumber + '\n' + CMD.BOLD_OFF;
  out += 'Date : ' + new Date().toLocaleString('en-IN') + '\n';
  out += 'Pay  : ' + bill.paymentMode + '\n';

  out += div() + '\n';

  // ITEMS HEADER
  out += CMD.BOLD_ON;
  out += 'Item             Qty   Rate   Amt\n';
  out += CMD.BOLD_OFF;
  out += div() + '\n';

  // ITEMS
  (bill.items || []).forEach(i => {
    const name = i.name.slice(0, 18).padEnd(18);
    const qty = String(i.quantity).padStart(3);
    const rate = money(i.price).padStart(7);
    const amt = money(i.total).padStart(7);
    out += `${name} ${qty} ${rate} ${amt}\n`;
  });

  out += div() + '\n';

  // TOTALS
  out += line('Subtotal', money(bill.subtotal)) + '\n';

  if (bill.discount > 0) {
    out += line('Discount', '-' + money(bill.discount)) + '\n';
  }

  if (bill.taxAmount > 0) {
    out += line('Tax', money(bill.taxAmount)) + '\n';
  }

  out += '='.repeat(W) + '\n';

  out += CMD.ALIGN_CENTER;
  out += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT;
  out += 'TOTAL: ' + money(bill.total) + '\n';
  out += CMD.NORMAL_SIZE + CMD.BOLD_OFF;

  out += div() + '\n';

  out += CMD.ALIGN_CENTER;
  out += (s.footerMessage || 'Thank You!') + '\n';

  out += CMD.FEED_1;
  out += CMD.CUT;

  return out;
}

// ─── FALLBACK PRINT ───
function browserPrintFallback(bill, s = {}) {

  const fmt = (n) => `Rs.${parseFloat(n || 0).toFixed(2)}`;

  const rows = (bill.items || []).map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${fmt(i.price)}</td>
      <td style="text-align:right">${fmt(i.total)}</td>
    </tr>
  `).join('');

  const html = `
  <html>
  <head>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    @page{size:80mm auto;margin:0;}

  body{
    width:72mm;
    margin:0 auto;
    padding:2mm 2mm 2mm 4mm; /* LEFT SHIFT */
    font-family:Arial;
    font-size:12px;
    font-weight:600;
    line-height:1.25;
  }

  table{
  margin-left:1mm;
  }

    h2{text-align:center;font-size:16px;margin-bottom:2px;}
    .d{border-top:1px dashed #000;margin:4px 0;}

    table{width:100%;border-collapse:collapse;}
    th,td{padding:2px 0;}
    th{border-bottom:1px solid #000;}

    .total td{
      font-weight:900;
      font-size:14px;
      border-top:2px solid #000;
    }

    .f{text-align:center;margin-top:5px;}
  </style>
  </head>
  <body>

  <h2>${s.storeName || ''}</h2>
  <div class="d"></div>

  <table>
    <thead>
      <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3">Subtotal</td><td>${fmt(bill.subtotal)}</td></tr>
      <tr class="total"><td colspan="3">TOTAL</td><td>${fmt(bill.total)}</td></tr>
    </tfoot>
  </table>

  <div class="f">${s.footerMessage || 'Thank You!'}</div>

  <script>
    window.onload=function(){
      window.print();
      setTimeout(()=>window.close(),500);
    }
  <\/script>

  </body>
  </html>
  `;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}