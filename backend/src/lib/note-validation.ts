import { z } from "zod";

// Payload accepted by POST/PUT /api/notes. `content` is editor HTML (capped to
// avoid unbounded payloads).
export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  content: z.string().max(100_000).default(""),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
