import { z } from "zod";

import { initialsFromName } from "./initials.js";

// Payload accepted by POST/PUT /api/appointments. Mirrors the frontend
// `NewAppointment` shape; `status` defaults to "confirmed" on create.
//
// Soft fields (initials/type/provider) tolerate gaps so AI-drafted rows from a
// sparse import (e.g. just name/date/time) still validate: initials are derived
// from the name and type/provider fall back to placeholders. Such rows are
// stamped `source: "ai"` and flagged for clinician review in the UI.
export const appointmentInputSchema = z
  .object({
    fileNumber: z.string().trim().default(""),
    name: z.string().trim().min(1, "Patient name is required.").max(200),
    initials: z.string().trim().max(4).default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:mm."),
    type: z.string().trim().max(120).default(""),
    provider: z.string().trim().max(200).default(""),
    status: z
      .enum(["confirmed", "checked-in", "completed", "cancelled"])
      .default("confirmed"),
    source: z.enum(["manual", "ai"]).default("manual"),
  })
  .transform((v) => ({
    ...v,
    initials: v.initials || initialsFromName(v.name),
    type: v.type || "Unspecified",
    provider: v.provider || "Unassigned",
  }));

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
