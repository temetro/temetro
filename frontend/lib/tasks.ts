import { apiFetch } from "@/lib/api-client";

// A care-team task. Mirrors the backend `src/types/task.ts`. Scoped to the active
// clinic (shared across the care team).
export type Priority = "high" | "medium" | "low";
// Board column the task sits in. `done` mirrors `status === "done"`.
export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  assignee: string;
  // Department (member role) the task is assigned to; null = personal task.
  assigneeRole: string | null;
  // A specific person the task is assigned to (user id); null otherwise.
  assigneeUserId: string | null;
  due: string;
  priority: Priority;
  status: TaskStatus;
  patient: string | null;
  notes: string | null;
  done: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

// Fields the "New task" dialog collects.
export type TaskInput = {
  title: string;
  assignee?: string;
  assigneeRole?: string | null;
  assigneeUserId?: string | null;
  due?: string;
  priority?: Priority;
  status?: TaskStatus;
  patient?: string | null;
  notes?: string | null;
};

// Any subset of fields, plus `done` (used by the complete/reopen toggle).
export type TaskPatch = Partial<TaskInput> & { done?: boolean };

export function listTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/api/tasks");
}

export function createTask(input: TaskInput): Promise<Task> {
  return apiFetch<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
}
