import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// One row per notification for a recipient, scoped to a clinic (organization).
// Written best-effort from events (a new message, a patient record change).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    text: text("text").notNull(),
    read: boolean("read").notNull().default(false),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    actorName: text("actor_name"),
    actorInitials: text("actor_initials"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notifications_org_user_read_idx").on(t.organizationId, t.userId, t.read)],
);
