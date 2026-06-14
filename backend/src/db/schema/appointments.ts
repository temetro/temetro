import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { AppointmentStatus } from "../../types/appointment.js";
import { organization, user } from "./auth.js";

// One row per scheduled visit, scoped to a clinic (organization). Patient
// identity is denormalized (name/initials/file number) so the schedule renders
// without joining; `date`/`time` are stored as plain strings to match the UI's
// local-date model exactly (no timezone drift).
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientFileNumber: text("patient_file_number").notNull().default(""),
    patientName: text("patient_name").notNull(),
    patientInitials: text("patient_initials").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    time: text("time").notNull(), // HH:mm
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    status: text("status").$type<AppointmentStatus>().notNull(),
    // Provenance: "ai" rows were drafted by the chat agent (possibly with
    // placeholder fields) and are flagged for clinician review/edit.
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
  (t) => [index("appointments_org_date_idx").on(t.organizationId, t.date)],
);
