import { z } from "zod";

import { initialsFromName } from "./initials.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");

export const invoiceLineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required.").max(300),
  quantity: z.coerce.number().min(0).max(100_000).default(1),
  unitPrice: z.coerce.number().min(0).max(10_000_000).default(0),
});

export const invoiceInstallmentSchema = z.object({
  label: z.string().trim().max(120).default(""),
  amount: z.coerce.number().min(0).max(10_000_000).default(0),
  dueAt: isoDate.nullable().default(null),
  paid: z.boolean().default(false),
});

// Payload accepted by POST/PUT /api/invoices. `number` and `issuedAt` are filled
// server-side on create when omitted; initials are derived from the name.
export const invoiceInputSchema = z
  .object({
    fileNumber: z.string().trim().default(""),
    name: z.string().trim().min(1, "Patient name is required.").max(200),
    initials: z.string().trim().max(4).default(""),
    number: z.string().trim().max(60).optional(),
    issuedAt: isoDate.optional(),
    dueAt: isoDate.nullish(),
    status: z.enum(["draft", "sent", "paid", "void"]).default("draft"),
    lineItems: z.array(invoiceLineItemSchema).default([]),
    installments: z.array(invoiceInstallmentSchema).default([]),
    notes: z.string().max(5000).nullish(),
    source: z.enum(["manual", "ai"]).default("manual"),
  })
  .transform((v) => ({
    ...v,
    initials: v.initials || initialsFromName(v.name),
  }));

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
