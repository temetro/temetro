import { z } from "zod";

// Payload accepted by POST/PUT /api/appointments. Mirrors the frontend
// `NewAppointment` shape; `status` defaults to "confirmed" on create.
export const appointmentInputSchema = z.object({
  fileNumber: z.string().trim().default(""),
  name: z.string().trim().min(1, "Patient name is required.").max(200),
  initials: z.string().trim().min(1).max(4),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:mm."),
  type: z.string().trim().min(1, "Type is required.").max(120),
  provider: z.string().trim().min(1, "Provider is required.").max(200),
  status: z
    .enum(["confirmed", "checked-in", "completed", "cancelled"])
    .default("confirmed"),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
