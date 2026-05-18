/**
 * components/store/PrintService.js
 * FINAL OPTIMIZED VERSION
 * ✅ Left margin fixed (prevents content cutting)
 * ✅ Compact thermal layout
 * ✅ Sharp bold text
 * ✅ Better spacing
 * ✅ Full store details added
 * ✅ RP3160 GOLD optimized
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
  FEED_2: ESC + 'd\x02',

  LINE_SPACING: ESC + '3\x16',
};

const DEFAULT_PRINTER_NAME = 'TVS RP3160 GOLD';
const PAPER_COLS = 42;

let qzInstance = null;

// ─────────────────────────────────────────────
// LOAD QZ
// ─────────────────────────────────────────────
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

      script.src =
        'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';

      script.onload = () => {
        qzInstance = window.qz;
        resolve();
      };

      document.head.appendChild(script);
    });
  }

  if (qzInstance) {
    qzInstance.security.setCertificatePromise((r) => r(''));
    qzInstance.security.setSignaturePromise(() => (r) => r(''));
  }

  return qzInstance;
}

// ─────────────────────────────────────────────
// CONNECT
// ─────────────────────────────────────────────
export async function connectQZ() {
  try {
    const qz = await loadQZ();

    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// PRINT RAW
// ─────────────────────────────────────────────
export async function printRaw(data, printer = DEFAULT_PRINTER_NAME) {
  const conn = await connectQZ();

  if (!conn.success) return conn;

  try {
    const qz = await loadQZ();

    const config = qz.configs.create(printer, {
      encoding: 'Cp1252',
      copies: 1,
    });

    await qz.print(
      config,
      data.map((d) => ({
        type: 'raw',
        format: 'plain',
        data: d,
      }))
    );

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// MAIN PRINT
// ─────────────────────────────────────────────
export async function printBillThermal(
  bill,
  settings = {}
) {
  try {
    const esc = buildESCPOS(bill, settings);

    const res = await printRaw([esc]);

    if (res.success) {
      return {
        method: 'qz',
        success: true,
      };
    }

    browserPrintFallback(bill, settings);

    return {
      method: 'browser',
      success: true,
    };
  } catch (e) {
    return {
      method: 'failed',
      success: false,
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// BUILD ESC/POS
// ─────────────────────────────────────────────
function buildESCPOS(bill, s = {}) {
  const W = PAPER_COLS;

  const money = (n) =>
    `Rs.${parseFloat(n || 0).toFixed(2)}`;

  const line = (left, right) => {
    right = String(right);

    const leftText = String(left).padEnd(
      W - right.length - 1
    );

    return leftText + ' ' + right;
  };

  const divider = '-'.repeat(W);

  const dateStr = new Date(
    bill.createdAt || Date.now()
  ).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let out = '';

  out += CMD.INIT;
  out += CMD.LINE_SPACING;

  // LEFT SAFE MARGIN
  out += '  ';

  // ───────────────── HEADER
  out += CMD.ALIGN_CENTER;

  out += CMD.BOLD_ON;
  out += CMD.DOUBLE_HEIGHT;

  out += 'SREE SAI MEDICAL\n';
  out += 'TECHNOLOGIES\n';

  out += CMD.NORMAL_SIZE;
  out += CMD.BOLD_OFF;

  out += 'No.13, ADHAVA COMPLEX\n';
  out += 'AMMA MANDAPAM ROAD\n';
  out += 'SRIRANGAM, TRICHY-620006\n';

  out += 'Ph : 9940720436\n';

  out += 'GST : 33ASFPA4973P1ZF\n';

  out += divider + '\n';

  // ───────────────── BILL INFO
  out += CMD.ALIGN_LEFT;

  out += CMD.BOLD_ON;
  out += 'Bill : ' + bill.billNumber + '\n';
  out += CMD.BOLD_OFF;

  out += 'Date : ' + dateStr + '\n';

  out += 'Pay  : ' + bill.paymentMode + '\n';

  if (bill.note) {
    out +=
      'Note : ' +
      String(bill.note).slice(0, 25) +
      '\n';
  }

  out += divider + '\n';

  // ───────────────── ITEMS HEADER
  out += CMD.BOLD_ON;

  out += 'Item           Qty   Rate    Amt\n';

  out += CMD.BOLD_OFF;

  out += divider + '\n';

  // ───────────────── ITEMS
  (bill.items || []).forEach((item) => {
    const name = String(item.name)
      .slice(0, 14)
      .padEnd(14);

    const qty = String(item.quantity)
      .slice(0, 3)
      .padStart(3);

    const rate = money(item.price).padStart(8);

    const amt = money(item.total).padStart(8);

    out += `${name} ${qty} ${rate} ${amt}\n`;

    if (item.name.length > 14) {
      out += '  ' + item.name.slice(14, 28) + '\n';
    }
  });

  out += divider + '\n';

  // ───────────────── TOTALS
  out += line('Subtotal', money(bill.subtotal)) + '\n';

  if (parseFloat(bill.discount) > 0) {
    out += line(
      'Discount',
      '-' + money(bill.discount)
    ) + '\n';
  }

  if (parseFloat(bill.taxAmount) > 0) {
    out += line(
      'Tax',
      money(bill.taxAmount)
    ) + '\n';
  }

  out += '='.repeat(W) + '\n';

  // ───────────────── GRAND TOTAL
  out += CMD.ALIGN_CENTER;

  out += CMD.BOLD_ON;
  out += CMD.DOUBLE_HEIGHT;

  out += 'TOTAL : ' + money(bill.total) + '\n';

  out += CMD.NORMAL_SIZE;
  out += CMD.BOLD_OFF;

  out += divider + '\n';

  // ───────────────── FOOTER
  out += CMD.ALIGN_CENTER;

  out += 'Thank You Visit Again!\n';

  out += CMD.FEED_2;

  out += CMD.CUT;

  return out;
}

// ─────────────────────────────────────────────
// BROWSER FALLBACK
// ─────────────────────────────────────────────
export function browserPrintFallback(
  bill,
  s = {}
) {
  const fmt = (n) =>
    `Rs.${parseFloat(n || 0).toFixed(2)}`;

  const rows = (bill.items || [])
    .map(
      (i) => `
      <tr>
        <td>${i.name}</td>
        <td style="text-align:center;">
          ${i.quantity}
        </td>
        <td style="text-align:right;">
          ${fmt(i.price)}
        </td>
        <td style="text-align:right;">
          ${fmt(i.total)}
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">

  <style>

    *{
      margin:0;
      padding:0;
      box-sizing:border-box;
    }

    @page{
      size:80mm auto;
      margin:0;
    }

    body{
      width:72mm;

      margin:0 auto;

      padding:
        2mm
        2mm
        2mm
        6mm;

      font-family:Arial,sans-serif;

      font-size:11px;

      font-weight:600;

      line-height:1.2;

      color:#000;
    }

    .title{
      text-align:center;
      font-size:18px;
      font-weight:900;
      margin-bottom:1mm;
    }

    .sub{
      text-align:center;
      font-size:10px;
      margin-bottom:1px;
      font-weight:700;
    }

    .divider{
      border-top:1px dashed #000;
      margin:3px 0;
    }

    .meta{
      font-size:10.5px;
      line-height:1.3;
      font-weight:700;
    }

    table{
      width:100%;
      border-collapse:collapse;
      margin-top:2px;
    }

    th{
      border-bottom:1px solid #000;
      padding:3px 1px;
      font-size:10px;
      text-align:left;
      font-weight:900;
    }

    td{
      padding:3px 1px;
      font-size:10.5px;
      border-bottom:1px dashed #bbb;
      vertical-align:top;
      font-weight:700;
    }

    .right{
      text-align:right;
    }

    .center{
      text-align:center;
    }

    .total td{
      border-top:2px solid #000;
      border-bottom:none;
      font-size:14px;
      font-weight:900;
      padding-top:4px;
    }

    .footer{
      text-align:center;
      margin-top:4px;
      font-size:10px;
      font-weight:800;
    }

  </style>
  </head>

  <body>

    <div class="title">
      SREE SAI MEDICAL TECHNOLOGIES
    </div>

    <div class="sub">
      No.13, ADHAVA COMPLEX
    </div>

    <div class="sub">
      AMMA MANDAPAM ROAD
    </div>

    <div class="sub">
      SRIRANGAM, TRICHY-620006
    </div>

    <div class="sub">
      Ph : 9940720436
    </div>

    <div class="sub">
      GST : 33ASFPA4973P1ZF
    </div>

    <div class="divider"></div>

    <div class="meta">
      Bill : ${bill.billNumber}
    </div>

    <div class="meta">
      Date : ${new Date().toLocaleString('en-IN')}
    </div>

    <div class="meta">
      Pay : ${bill.paymentMode}
    </div>

    <div class="divider"></div>

    <table>

      <thead>
        <tr>
          <th>Item</th>
          <th class="center">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Amt</th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>

      <tfoot>

        <tr>
          <td colspan="3">
            Subtotal
          </td>

          <td class="right">
            ${fmt(bill.subtotal)}
          </td>
        </tr>

        ${
          parseFloat(bill.taxAmount) > 0
            ? `
          <tr>
            <td colspan="3">
              Tax
            </td>

            <td class="right">
              ${fmt(bill.taxAmount)}
            </td>
          </tr>
        `
            : ''
        }

        <tr class="total">
          <td colspan="3">
            TOTAL
          </td>

          <td class="right">
            ${fmt(bill.total)}
          </td>
        </tr>

      </tfoot>

    </table>

    <div class="divider"></div>

    <div class="footer">
      Thank You Visit Again!
    </div>

    <script>
      window.onload = function(){

        window.print();

        setTimeout(function(){
          window.close();
        },500);

      };
    <\/script>

  </body>
  </html>
  `;

  const win = window.open(
    '',
    '_blank',
    'width=420,height=700'
  );

  if (win) {
    win.document.write(html);
    win.document.close();
  }
}