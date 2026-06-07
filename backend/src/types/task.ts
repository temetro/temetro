// The canonical Task shape returned by the API. Mirrors the frontend
// `lib/tasks.ts` Task type. Scoped to the active clinic (a shared care-team
// to-do board). `patient` is an optional free-text reference for context.
export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  assignee: string;
  due: string;
  priority: TaskPriority;
  patient: string | null;
  notes: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};
