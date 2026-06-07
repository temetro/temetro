import { z } from "zod";

// Payload accepted by POST /api/tasks (full create).
export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "A task subject is required.").max(200),
  assignee: z.string().trim().max(200).default("Unassigned"),
  due: z.string().trim().max(120).default("No due date"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  patient: z.string().trim().max(200).nullish(),
  notes: z.string().max(5000).nullish(),
});

// Payload accepted by PATCH /api/tasks/:id — any subset of fields, plus `done`
// (used by the list/detail toggle).
export const taskPatchSchema = taskInputSchema.partial().extend({
  done: z.boolean().optional(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskPatch = z.infer<typeof taskPatchSchema>;
