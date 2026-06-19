import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

// A scheduled staff meeting (calendar event), scoped to a clinic. `participants`
// holds the invited staff user ids; `date`/`time` are local strings (YYYY-MM-DD /
// HH:mm) like appointments, to avoid timezone drift on the calendar.
export const scheduledMeetings = pgTable(
  "scheduled_meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    participants: jsonb("participants").$type<string[]>().notNull().default([]),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("scheduled_meetings_org_idx").on(table.organizationId)],
);
