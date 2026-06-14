import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

// Payload accepted by POST/PUT /api/prescriptions. The frontend dialog omits
// prescriber / prescribedAt / status on create — the route fills the prescriber
// from the signed-in user, the DB defaults prescribedAt to today, and status
// defaults to "active".
export const prescriptionInputSchema = z.object({
  fileNumber: z.string().trim().default(""),
  name: nonEmpty.max(200),
  initials: z.string().trim().min(1).max(4),
  medication: nonEmpty.max(200),
  dose: z.string().trim().max(120).default(""),
  frequency: nonEmpty.max(120),
  prescriber: z.string().trim().max(200).default(""),
  prescribedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .optional(),
  status: z.enum(["active", "completed", "expired"]).default("active"),
  duration: z.string().trim().max(120).nullish(),
  notes: z.string().max(5000).nullish(),
  source: z.enum(["manual", "ai"]).default("manual"),
});

export type PrescriptionInput = z.infer<typeof prescriptionInputSchema>;
