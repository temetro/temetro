import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth.js";

// Per-clinic (organization) settings. Currently holds the clinic's physical
// location — a free-text address plus optional map coordinates — set in
// Settings → Location by an owner/admin and surfaced to patients in the wallet
// app later (e.g. a map pin for a clinic that shared a record). One row per org
// (PK = organizationId), mirroring `clinic_signing_keys`.
export const clinicSettings = pgTable("clinic_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  // Optional map coordinates (WGS84). Null until the clinic sets them.
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
