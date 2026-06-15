import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth.js";

// Clinic-wide AI availability, controlled by owners/admins. One row per clinic
// (organization). Absent row = AI enabled for everyone (the default).
//   aiEnabled = false           → AI hidden + blocked for the whole clinic.
//   disabledForEmployees = true → AI hidden + blocked for non-admins; owners
//                                 and admins keep access.
export const orgAiPolicy = pgTable("org_ai_policy", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  disabledForEmployees: boolean("disabled_for_employees")
    .notNull()
    .default(false),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
