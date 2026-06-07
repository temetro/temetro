import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { TaskPriority } from "../../types/task.js";
import { organization, user } from "./auth.js";

// One row per care-team to-do, scoped to a clinic (organization). Shared across
// the clinic (unlike notes, which are per-author). `assignee`/`due`/`patient`
// are free text to match the lightweight board UI.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    assignee: text("assignee").notNull().default("Unassigned"),
    due: text("due").notNull().default("No due date"),
    priority: text("priority").$type<TaskPriority>().notNull(),
    patient: text("patient"),
    notes: text("notes"),
    done: boolean("done").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("tasks_org_idx").on(t.organizationId)],
);
