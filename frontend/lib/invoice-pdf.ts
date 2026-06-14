import {
  formatInvoiceDate,
  formatMoney,
  type Invoice,
  invoiceTotal,
} from "@/lib/invoices";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Render an invoice into a clean, print-styled document in a new window and
// trigger the browser's print dialog, where the clinician can "Save as PDF".
// Dependency-free — no PDF library needed; swap for jsPDF later if a generated
// file is required.
export function downloadInvoicePdf(invoice: Invoice, clinicName = "temetro") {
  const win = window.open("", "_blank", "width=820,height=1040");
  if (!win) return;

  const total = invoiceTotal(invoice);
  const lineRows = invoice.lineItems
    .map(
      (li) => `<tr>
        <td>${esc(li.description)}</td>
        <td class="num">${li.quantity}</td>
        <td class="num">${formatMoney(li.unitPrice)}</td>
        <td class="num">${formatMoney(li.quantity * li.unitPrice)}</td>
      </tr>`,
    )
    .join("");

  const installmentRows = invoice.installments.length
    ? `<h2>Installments</h2>
       <table>
         <thead><tr><th>Installment</th><th class="num">Due</th><th class="num">Amount</th><th class="num">Status</th></tr></thead>
         <tbody>${invoice.installments
           .map(
             (it) => `<tr>
               <td>${esc(it.label)}</td>
               <td class="num">${it.dueAt ? formatInvoiceDate(it.dueAt) : "—"}</td>
               <td class="num">${formatMoney(it.amount)}</td>
               <td class="num">${it.paid ? "Paid" : "Unpaid"}</td>
             </tr>`,
           )
           .join("")}</tbody>
       </table>`
    : "";

  const notes = invoice.notes
    ? `<h2>Notes</h2><p class="notes">${esc(invoice.notes)}</p>`
    : "";

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(invoice.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 40px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
  .meta { text-align: right; font-size: 13px; color: #444; }
  .meta strong { color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e5e5; }
  th { color: #555; font-weight: 600; }
  .num { text-align: right; }
  tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; font-size: 15px; }
  .patient { margin-top: 24px; font-size: 14px; }
  .notes { font-size: 13px; color: #333; white-space: pre-wrap; }
  @media print { body { margin: 0.6in; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${esc(clinicName)}</h1>
      <div style="font-size:13px;color:#555;margin-top:4px;">Invoice</div>
    </div>
    <div class="meta">
      <div><strong>${esc(invoice.number)}</strong></div>
      <div>Issued ${formatInvoiceDate(invoice.issuedAt)}</div>
      ${invoice.dueAt ? `<div>Due ${formatInvoiceDate(invoice.dueAt)}</div>` : ""}
      <div>Status: ${esc(invoice.status)}</div>
    </div>
  </header>

  <div class="patient">
    <strong>Bill to:</strong> ${esc(invoice.name)}${invoice.fileNumber ? ` · File #${esc(invoice.fileNumber)}` : ""}
  </div>

  <h2>Line items</h2>
  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
    <tbody>${lineRows || `<tr><td colspan="4" style="color:#888;">No line items</td></tr>`}</tbody>
    <tfoot><tr><td colspan="3" class="num">Total</td><td class="num">${formatMoney(total)}</td></tr></tfoot>
  </table>

  ${installmentRows}
  ${notes}

  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
