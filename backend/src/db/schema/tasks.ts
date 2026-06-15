import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { TaskPriority, TaskStatus } from "../../types/task.js";
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
    // The department (member role) a task is assigned to, e.g. "reception".
    // Null means a personal task belonging to its creator. Drives who sees it.
    assigneeRole: text("assignee_role"),
    due: text("due").notNull().default("No due date"),
    priority: text("priority").$type<TaskPriority>().notNull(),
    // Board column: todo | in_progress | done. Kept in sync with `done`
    // (done === status === "done") so the legacy toggle still works.
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    patient: text("patient"),
    notes: text("notes"),
    done: boolean("done").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    // Denormalised creator name so "created by …" survives even if the user is
    // later removed (createdBy is set null on delete).
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("tasks_org_idx").on(t.organizationId)],
);
