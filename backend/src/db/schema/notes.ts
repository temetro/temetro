import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// A doctor's freeform note, scoped to a clinic (organization) AND its author —
// notes are private to the doctor who wrote them within that clinic. `content`
// holds the rich-text editor's HTML.
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("notes_org_author_idx").on(t.organizationId, t.authorId)],
);
