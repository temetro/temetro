import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { PrescriptionStatus } from "../../types/prescription.js";
import { organization, user } from "./auth.js";

// One row per prescribed medication, scoped to a clinic (organization). Patient
// identity is denormalized (name/initials/file number) so the ledger renders
// without joining. `prescribedAt` defaults to today.
export const prescriptions = pgTable(
  "prescriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientFileNumber: text("patient_file_number").notNull().default(""),
    patientName: text("patient_name").notNull(),
    patientInitials: text("patient_initials").notNull(),
    medication: text("medication").notNull(),
    dose: text("dose").notNull().default(""),
    frequency: text("frequency").notNull(),
    prescriber: text("prescriber").notNull(),
    prescribedAt: date("prescribed_at").defaultNow().notNull(),
    // Optional explicit course window. When set, `endDate` drives expiry instead
    // of parsing the free-text `duration`. Both are opt-in (the dialog reveals
    // them behind a toggle), so they stay nullable.
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: text("status").$type<PrescriptionStatus>().notNull(),
    duration: text("duration"),
    notes: text("notes"),
    // Provenance: "ai" rows were drafted by the chat agent and flagged for review.
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
  (t) => [index("prescriptions_org_idx").on(t.organizationId)],
);
