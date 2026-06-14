import {
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  InvoiceInstallment,
  InvoiceLineItem,
  InvoiceStatus,
} from "../../types/invoice.js";
import { organization, user } from "./auth.js";

// One row per patient invoice, scoped to a clinic (organization). Patient
// identity is denormalized (name/initials/file number) so the ledger renders
// without joining. Line items and installments are stored as JSONB. `issuedAt`
// defaults to today.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientFileNumber: text("patient_file_number").notNull().default(""),
    patientName: text("patient_name").notNull(),
    patientInitials: text("patient_initials").notNull(),
    number: text("number").notNull(),
    issuedAt: date("issued_at").defaultNow().notNull(),
    dueAt: date("due_at"),
    status: text("status").$type<InvoiceStatus>().notNull(),
    lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull(),
    installments: jsonb("installments")
      .$type<InvoiceInstallment[]>()
      .notNull(),
    notes: text("notes"),
    source: text("source").$type<"manual" | "ai">().notNull().default("manual"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("invoices_org_idx").on(t.organizationId),
    index("invoices_org_file_idx").on(t.organizationId, t.patientFileNumber),
  ],
);
