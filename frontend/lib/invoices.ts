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

export function splitInvoice(id: string, count: number): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/invoices/${id}/split`, {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

export function deleteInvoice(id: string): Promise<void> {
  return apiFetch<void>(`/api/invoices/${id}`, { method: "DELETE" });
}
