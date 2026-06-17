import { apiFetch } from "@/lib/api-client";

// An invoice. Mirrors the backend `src/types/invoice.ts`. Scoped to the active
// clinic; `fileNumber` links back to a patient record.
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceInstallment = {
  label: string;
  amount: number;
  dueAt: string | null;
  paid: boolean;
};

export type Invoice = {
  id: string;
  fileNumber: string;
  name: string;
  initials: string;
  number: string;
  issuedAt: string; // YYYY-MM-DD
  dueAt: string | null;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  installments: InvoiceInstallment[];
  notes: string | null;
  source: "manual" | "ai";
  createdAt: string;
  updatedAt: string;
};

// The fields the create/edit dialog collects; the backend fills the number and
// issuedAt on create when omitted.
export type InvoiceInput = {
  fileNumber: string;
  name: string;
  initials: string;
  number?: string;
  issuedAt?: string;
  dueAt?: string | null;
  status?: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  installments?: InvoiceInstallment[];
  notes?: string | null;
  source?: "manual" | "ai";
};

export function invoiceTotal(invoice: {
  lineItems: InvoiceLineItem[];
}): number {
  return invoice.lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0,
  );
}

const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

export function formatMoney(amount: number): string {
  return money.format(amount);
}

// "2026-06-05" -> "Jun 5, 2026"
export function formatInvoiceDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function listInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice[]>("/api/invoices");
}

export function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return apiFetch<Invoice>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateInvoice(
  id: string,
  input: InvoiceInput,
): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// Rebuild the editable input payload from a full invoice, so a partial change
// (paying it, paying an installment) round-trips through PUT without dropping
// any fields.
function invoiceToInput(inv: Invoice): InvoiceInput {
  return {
    fileNumber: inv.fileNumber,
    name: inv.name,
    initials: inv.initials,
    number: inv.number,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    status: inv.status,
    lineItems: inv.lineItems,
    installments: inv.installments,
    notes: inv.notes,
    source: inv.source,
  };
}

// Mark the whole invoice paid: status → paid and every installment settled.
export function markInvoicePaid(inv: Invoice): Promise<Invoice> {
  return updateInvoice(inv.id, {
    ...invoiceToInput(inv),
    status: "paid",
    installments: inv.installments.map((it) => ({ ...it, paid: true })),
  });
}

// Settle a single installment. When that clears the last one, the invoice flips
// to paid automatically.
export function payInstallment(inv: Invoice, index: number): Promise<Invoice> {
  const installments = inv.installments.map((it, i) =>
    i === index ? { ...it, paid: true } : it,
  );
  const allPaid = installments.length > 0 && installments.every((it) => it.paid);
  return updateInvoice(inv.id, {
    ...invoiceToInput(inv),
    installments,
    status: allPaid ? "paid" : inv.status,
  });
}

// True when an unpaid installment's due date has passed.
export function isInstallmentOverdue(it: InvoiceInstallment): boolean {
  if (it.paid || !it.dueAt) return false;
  const due = new Date(`${it.dueAt}T23:59:59`);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export function splitInvoice(id: string, count: number): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${id}/split`, {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

export function deleteInvoice(id: string): Promise<void> {
  return apiFetch<void>(`/api/invoices/${id}`, { method: "DELETE" });
}
