import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// A persistent staff meeting room (Discord-style voice/video channel), scoped to
// a clinic. Rooms are long-lived "channels"; the live call (participants, media)
// is ephemeral and lives only in the realtime layer — nothing about an in-call
// session is persisted here.
export const meetingRooms = pgTable(
  "meeting_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("meeting_rooms_org_idx").on(table.organizationId)],
);
