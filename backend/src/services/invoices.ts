import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { invoices } from "../db/schema/invoices.js";
import type { InvoiceInput } from "../lib/invoice-validation.js";
import type { Invoice, InvoiceInstallment } from "../types/invoice.js";

type InvoiceRow = typeof invoices.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    fileNumber: row.patientFileNumber,
    name: row.patientName,
    initials: row.patientInitials,
    number: row.number,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    status: row.status,
    lineItems: row.lineItems,
    installments: row.installments,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function columns(orgId: string, input: InvoiceInput, createdBy?: string) {
  return {
    organizationId: orgId,
    patientFileNumber: input.fileNumber,
    patientName: input.name,
    patientInitials: input.initials,
    number: input.number ?? "",
    status: input.status,
    lineItems: input.lineItems,
    installments: input.installments,
    notes: input.notes ?? null,
    source: input.source,
    ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
    dueAt: input.dueAt ?? null,
    ...(createdBy ? { createdBy } : {}),
  };
}

export function invoiceTotal(input: {
  lineItems: { quantity: number; unitPrice: number }[];
}): number {
  return input.lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0,
  );
}

// Next human invoice number for an org: "INV-" + (max existing numeric suffix +
// 1, floored at 1000). Falls back cleanly when there are no prior invoices.
async function generateInvoiceNumber(orgId: string): Promise<string> {
  const [r] = await db
    .select({
      max: sql<number>`coalesce(max(nullif(regexp_replace(${invoices.number}, '\\D', '', 'g'), '')::bigint), 999)`,
    })
    .from(invoices)
    .where(eq(invoices.organizationId, orgId));
  return `INV-${Number(r?.max ?? 999) + 1}`;
}

// Add `months` calendar months to an ISO (YYYY-MM-DD) date, returning an ISO
// date. Used to stagger installment due dates from the issue date.
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m! - 1) + months, d!));
  return base.toISOString().slice(0, 10);
}

export async function listInvoices(orgId: string): Promise<Invoice[]> {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.organizationId, orgId))
    .orderBy(desc(invoices.issuedAt), desc(invoices.createdAt));
  return rows.map(toInvoice);
}

export async function getInvoice(
  orgId: string,
  id: string,
): Promise<Invoice | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)));
  return row ? toInvoice(row) : null;
}

export async function createInvoice(
  orgId: string,
  userId: string,
  input: InvoiceInput,
): Promise<Invoice> {
  const number = input.number || (await generateInvoiceNumber(orgId));
  const [row] = await db
    .insert(invoices)
    .values(columns(orgId, { ...input, number }, userId))
    .returning();
  return toInvoice(row!);
}

export async function updateInvoice(
  orgId: string,
  id: string,
  input: InvoiceInput,
): Promise<Invoice | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .update(invoices)
    .set(columns(orgId, input))
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
    .returning();
  return row ? toInvoice(row) : null;
}

export async function deleteInvoice(
  orgId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
    .returning({ id: invoices.id });
  return deleted.length > 0;
}

// Split an invoice's total into `count` roughly-equal installments, staggered
// one month apart from the issue date. Amounts are computed in cents so they
// always sum back to the exact total (any remainder lands on the first slice).
export async function splitIntoInstallments(
  orgId: string,
  id: string,
  count: number,
): Promise<Invoice | null> {
  const invoice = await getInvoice(orgId, id);
  if (!invoice) return null;
  const n = Math.max(1, Math.min(36, Math.floor(count)));
  const totalCents = Math.round(invoiceTotal(invoice) * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  const installments: InvoiceInstallment[] = Array.from(
    { length: n },
    (_, i) => ({
      label: `${i + 1} of ${n}`,
      amount: (base + (i < remainder ? 1 : 0)) / 100,
      dueAt: addMonths(invoice.issuedAt, i),
      paid: false,
    }),
  );

  const [row] = await db
    .update(invoices)
    .set({ installments })
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
    .returning();
  return row ? toInvoice(row) : null;
}
