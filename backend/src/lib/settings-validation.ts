import { z } from "zod";

// Payload accepted by PUT /api/settings: a flat map of preference keys to
// booleans or short strings. Capped so the JSONB column can't grow unbounded.
export const settingsInputSchema = z.object({
  preferences: z
    .record(
      z.string().min(1).max(64),
      z.union([z.boolean(), z.string().max(500)]),
    )
    .refine((prefs) => Object.keys(prefs).length <= 100, {
      message: "Too many preference keys.",
    }),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
