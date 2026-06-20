import { and, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "../db/index.js";
import { tasks } from "../db/schema/tasks.js";
import type { TaskInput, TaskPatch } from "../lib/task-validation.js";
import type { Task } from "../types/task.js";

type TaskRow = typeof tasks.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rolesOf(role: string): string[] {
  return String(role ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    assigneeRole: row.assigneeRole,
    assigneeUserId: row.assigneeUserId,
    due: row.due,
    priority: row.priority,
    status: row.status,
    patient: row.patient,
    notes: row.notes,
    done: row.done,
    createdById: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// A member sees a task if they created it or it's assigned to their department.
// Owners/admins see every task in the clinic.
export async function listTasks(
  orgId: string,
  viewer: { userId: string; role: string },
): Promise<Task[]> {
  const roles = rolesOf(viewer.role);
  const isAdmin = roles.some((r) => r === "owner" || r === "admin");

  let where = eq(tasks.organizationId, orgId);
  if (!isAdmin) {
    const visible = [
      eq(tasks.createdBy, viewer.userId),
      // Tasks assigned to this person specifically.
      eq(tasks.assigneeUserId, viewer.userId),
    ];
    if (roles.length) visible.push(inArray(tasks.assigneeRole, roles));
    where = and(where, or(...visible))!;
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.createdAt));
  return rows.map(toTask);
}

export async function createTask(
  orgId: string,
  creator: { id: string; name: string },
  input: TaskInput,
): Promise<Task> {
  const [row] = await db
    .insert(tasks)
    .values({
      organizationId: orgId,
      title: input.title,
      assignee: input.assignee,
      assigneeRole: input.assigneeRole ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      due: input.due,
      priority: input.priority,
      status: input.status,
      // Keep the legacy `done` flag in lock-step with the board column.
      done: input.status === "done",
      patient: input.patient ?? null,
      notes: input.notes ?? null,
      createdBy: creator.id,
      createdByName: creator.name,
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
  if (patch.assigneeRole !== undefined)
    set.assigneeRole = patch.assigneeRole ?? null;
  if (patch.assigneeUserId !== undefined)
    set.assigneeUserId = patch.assigneeUserId ?? null;
  if (patch.due !== undefined) set.due = patch.due;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.patient !== undefined) set.patient = patch.patient ?? null;
  if (patch.notes !== undefined) set.notes = patch.notes ?? null;
  // Keep `status` and the legacy `done` flag in sync: a status patch wins and
  // sets done; a bare done toggle maps to done/todo.
  if (patch.status !== undefined) {
    set.status = patch.status;
    set.done = patch.status === "done";
  } else if (patch.done !== undefined) {
    set.done = patch.done;
    set.status = patch.done ? "done" : "todo";
  }

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
