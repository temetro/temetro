import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// One row per medication held in a clinic's pharmacy stock, scoped to a clinic
// (organization). Unlike prescriptions (dispensed courses), this is the standing
// inventory the pharmacy searches to check availability. Availability
// (in-stock / low / out) is derived from `stockQuantity` vs `reorderThreshold`
// at read time, not stored.
export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    form: text("form").notNull().default(""),
    strength: text("strength").notNull().default(""),
    unit: text("unit").notNull().default(""),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    location: text("location").notNull().default(""),
    expiresAt: date("expires_at"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("inventory_org_idx").on(t.organizationId)],
);
