import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

// Payload accepted by POST /api/dispenses. Recorded when the pharmacy dispenses
// a medication (typically from the dispensing queue). The route fills the
// dispenser identity from the signed-in user and the DB defaults `dispensedAt`.
export const dispenseInputSchema = z.object({
  fileNumber: z.string().trim().default(""),
  name: nonEmpty.max(200),
  initials: z.string().trim().max(4).default(""),
  medication: nonEmpty.max(200),
  dose: z.string().trim().max(120).default(""),
  quantity: z.number().int().min(0).max(1_000_000).default(0),
  unit: z.string().trim().max(60).default(""),
  prescriptionId: z.string().uuid().nullish(),
  notes: z.string().max(5000).nullish(),
});

export type DispenseInput = z.infer<typeof dispenseInputSchema>;
