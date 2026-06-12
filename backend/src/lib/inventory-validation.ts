import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

// Payload accepted by POST/PUT /api/inventory. Only the medication name is
// required; quantities default to 0 and the descriptive fields to empty strings
// so a quick add (name only) is valid.
export const inventoryInputSchema = z.object({
  name: nonEmpty.max(200),
  form: z.string().trim().max(120).default(""),
  strength: z.string().trim().max(120).default(""),
  unit: z.string().trim().max(60).default(""),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  reorderThreshold: z.number().int().min(0).max(1_000_000).default(0),
  location: z.string().trim().max(200).default(""),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .nullish(),
  notes: z.string().max(5000).nullish(),
});

export type InventoryInput = z.infer<typeof inventoryInputSchema>;
