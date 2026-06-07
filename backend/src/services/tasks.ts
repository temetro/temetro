import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { tasks } from "../db/schema/tasks.js";
import type { TaskInput, TaskPatch } from "../lib/task-validation.js";
import type { Task } from "../types/task.js";

type TaskRow = typeof tasks.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    due: row.due,
    priority: row.priority,
    patient: row.patient,
    notes: row.notes,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTasks(orgId: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, orgId))
    .orderBy(desc(tasks.createdAt));
  return rows.map(toTask);
}

export async function createTask(
  orgId: string,
  userId: string,
  input: TaskInput,
): Promise<Task> {
  const [row] = await db
    .insert(tasks)
    .values({
      organizationId: orgId,
      title: input.title,
      assignee: input.assignee,
      due: input.due,
      priority: input.priority,
      patient: input.patient ?? null,
      notes: input.notes ?? null,
      createdBy: userId,
    })
    .returning();
  return toTask(row!);
}

export async function updateTask(
  orgId: string,
  id: string,
  patch: TaskPatch,
): Promise<Task | null> {
  if (!UUID_RE.test(id)) return null;

  // Build a set object from only the provided fields.
  const set: Partial<typeof tasks.$inferInsert> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.assignee !== undefined) set.assignee = patch.assignee;
  if (patch.due !== undefined) set.due = patch.due;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.patient !== undefined) set.patient = patch.patient ?? null;
  if (patch.notes !== undefined) set.notes = patch.notes ?? null;
  if (patch.done !== undefined) set.done = patch.done;

  if (Object.keys(set).length === 0) {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)));
    return row ? toTask(row) : null;
  }

  const [row] = await db
    .update(tasks)
    .set(set)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)))
    .returning();
  return row ? toTask(row) : null;
}

export async function deleteTask(orgId: string, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)))
    .returning({ id: tasks.id });
  return deleted.length > 0;
}
