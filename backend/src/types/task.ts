// The canonical Task shape returned by the API. Mirrors the frontend
// `lib/tasks.ts` Task type. Scoped to the active clinic (a shared care-team
// to-do board). `patient` is an optional free-text reference for context.
export type TaskPriority = "high" | "medium" | "low";
// Board column the task sits in. `done` mirrors `status === "done"`.
export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  assignee: string;
  // Department (member role) the task is assigned to; null = personal task.
  assigneeRole: string | null;
  // A specific person the task is assigned to (user id); null when assigned to
  // a department or kept personal. Takes precedence over assigneeRole for who
  // sees the task.
  assigneeUserId: string | null;
  due: string;
  priority: TaskPriority;
  status: TaskStatus;
  patient: string | null;
  notes: string | null;
  done: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};
