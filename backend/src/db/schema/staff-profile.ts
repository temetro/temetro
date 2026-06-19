import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// Per-member, per-clinic profile extras that Better Auth's member row doesn't
// hold. Currently just a doctor's clinical specialty (e.g. "Orthopedist",
// "Dentist") which the admin sets in Care Team and surfaces on the patient
// sheet for the patient's primary provider. Unique on (org, user) so each
// member has at most one profile per clinic.
export const staffProfile = pgTable(
  "staff_profile",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    specialty: text("specialty"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("staff_profile_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
  ],
);
