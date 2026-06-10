import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth.js";

// Per-user preferences (notification toggles, profile extras). One row per
// user, keyed by the Better Auth user id; the payload is a flat JSONB map so
// the frontend can add settings without a migration.
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences")
    .$type<Record<string, boolean | string>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
