// Receipt + kitchen-ticket printing. Opens a minimal print window styled for
// an 80mm thermal roll and triggers the browser print dialog. Kept dependency-free
// so it works in both the customer menu and the staff dashboard.

const CURRENCY = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

function money(value) {
  return CURRENCY.format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", monospace;
    width: 280px;
    margin: 0 auto;
    padding: 12px;
    color: #000;
  }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .muted { color: #444; font-size: 11px; text-align: center; margin: 0 0 8px; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  .row span:last-child { text-align: right; }
  .item { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
  .item .qty { font-weight: bold; }
  .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 6px; }
  .code { text-align: center; font-size: 22px; letter-spacing: 6px; font-weight: bold; margin: 6px 0; }
  .note { font-size: 12px; border: 1px solid #000; padding: 6px; margin-top: 8px; }
  .foot { text-align: center; font-size: 11px; margin-top: 10px; }
  @media print { body { width: auto; } }
`;

function openPrintWindow(title, bodyHtml) {
  if (typeof window === "undefined") {
    return;
  }

  const printWindow = window.open("", "_blank", "width=380,height=640");
  if (!printWindow) {
    window.alert("Allow pop-ups to print the receipt.");
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${BASE_STYLES}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();

  // Give the document a tick to lay out before printing.
  printWindow.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

function itemsHtml(items, { showPrices }) {
  return (items || [])
    .map((item) => {
      const right = showPrices ? money(item.lineTotal) : "";
      return `<div class="item"><span><span class="qty">${Number(
        item.quantity,
      )}x</span> ${escapeHtml(item.name)}</span><span>${right}</span></div>`;
    })
    .join("");
}

// Full customer receipt — restaurant header, code, items, prices, total.
export function printCustomerReceipt({ restaurant, receipt }) {
  const created = receipt.createdAt ? new Date(receipt.createdAt) : new Date();
  const body = `
    <h1>${escapeHtml(restaurant?.name || "Mapolos")}</h1>
    <p class="muted">${escapeHtml(restaurant?.location || "")}</p>
    <div class="divider"></div>
    <div class="row"><span>Order</span><span>#${escapeHtml(receipt.orderId)}</span></div>
    <div class="row"><span>Table</span><span>${escapeHtml(receipt.tableNumber || "Walk-in")}</span></div>
    ${receipt.customerName ? `<div class="row"><span>Guest</span><span>${escapeHtml(receipt.customerName)}</span></div>` : ""}
    <div class="row"><span>Time</span><span>${created.toLocaleString()}</span></div>
    <div class="divider"></div>
    <p class="muted">Verification code</p>
    <div class="code">${escapeHtml(receipt.verificationCode || "------")}</div>
    <div class="divider"></div>
    ${itemsHtml(receipt.items, { showPrices: true })}
    <div class="divider"></div>
    <div class="total"><span>Total</span><span>${money(receipt.totalPrice)}</span></div>
    ${receipt.specialRequest ? `<div class="note">Note: ${escapeHtml(receipt.specialRequest)}</div>` : ""}
    <p class="foot">Thank you — show your code to a server to confirm.</p>
  `;
  openPrintWindow(`Receipt #${receipt.orderId}`, body);
}

// Kitchen ticket — what the line cooks need: table, items, special request. No prices.
export function printKitchenTicket({ restaurant, order }) {
  const created = order.createdAt ? new Date(order.createdAt) : new Date();
  const body = `
    <h1>KITCHEN TICKET</h1>
    <p class="muted">${escapeHtml(restaurant?.name || "Mapolos")}</p>
    <div class="divider"></div>
    <div class="row"><span>Order</span><span>#${escapeHtml(order.id)}</span></div>
    <div class="row"><span>Table</span><span>${escapeHtml(order.tableNumber || "Walk-in")}</span></div>
    ${order.customerName ? `<div class="row"><span>Guest</span><span>${escapeHtml(order.customerName)}</span></div>` : ""}
    <div class="row"><span>Time</span><span>${created.toLocaleTimeString()}</span></div>
    <div class="divider"></div>
    ${itemsHtml(order.items, { showPrices: false })}
    ${order.specialRequest ? `<div class="note">⚠ ${escapeHtml(order.specialRequest)}</div>` : ""}
    <p class="foot">Fire when ready.</p>
  `;
  openPrintWindow(`Kitchen ticket #${order.id}`, body);
}
