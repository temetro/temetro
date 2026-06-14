import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// Persisted AI-chat threads (Claude-style history), per user within a clinic.
// The thread id is client-generated (nanoid) so the frontend can start saving a
// fresh chat without a round-trip. Messages store the full UIMessage `parts`
// (text + custom record cards) as JSONB so a reopened thread renders exactly as
// it did live.
export const aiChatThreads = pgTable(
  "ai_chat_threads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("ai_threads_org_user_idx").on(t.organizationId, t.userId)],
);

export const aiChatMessages = pgTable(
  "ai_chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => aiChatThreads.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("ai_messages_thread_idx").on(t.threadId, t.position)],
);
