import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// One row per dispensing event — the record of a medication actually handed to a
// patient at the pharmacy, scoped to a clinic (organization). Distinct from
// `prescriptions` (the order) and `inventory` (standing stock): this is the
// fulfilment ledger ("who took which medication"). Patient + dispenser identity
// are denormalized so the list renders without joining; `prescriptionId` links
// back to the source order when the dispense came from the queue.
export const dispenses = pgTable(
  "dispenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientFileNumber: text("patient_file_number").notNull().default(""),
    patientName: text("patient_name").notNull(),
    patientInitials: text("patient_initials").notNull().default(""),
    medication: text("medication").notNull(),
    dose: text("dose").notNull().default(""),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default(""),
    prescriptionId: uuid("prescription_id"),
    dispensedBy: text("dispensed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    dispensedByName: text("dispensed_by_name").notNull().default(""),
    dispensedAt: timestamp("dispensed_at").defaultNow().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("dispenses_org_idx").on(t.organizationId)],
);
