import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const allergySchema = z.object({
  substance: nonEmpty,
  reaction: nonEmpty,
  severity: z.enum(["mild", "moderate", "severe"]),
});

export const medicationSchema = z.object({
  name: nonEmpty,
  dose: nonEmpty,
  frequency: nonEmpty,
});

export const problemSchema = z.object({
  label: nonEmpty,
  since: nonEmpty,
});

export const labSchema = z.object({
  name: nonEmpty,
  value: nonEmpty,
  flag: z.enum(["normal", "high", "low", "critical"]),
  takenAt: nonEmpty,
});

export const encounterSchema = z.object({
  date: nonEmpty,
  type: nonEmpty,
  provider: nonEmpty,
  summary: nonEmpty,
});

export const vitalsSchema = z.object({
  bp: z.string(),
  hr: z.string(),
  temp: z.string(),
  spo2: z.string(),
  takenAt: z.string(),
});

export const trendSchema = z.object({
  label: z.string(),
  unit: z.string(),
  points: z.array(z.number()),
});

// A full patient payload — the frontend form sends the entire record on both
// create and edit, so the same schema covers both.
export const patientInputSchema = z.object({
  fileNumber: z.string().trim().regex(/^\d+$/, "File number must be digits"),
  name: nonEmpty,
  age: z.number().int().min(0).max(150),
  sex: z.enum(["M", "F"]),
  pcp: z.string(),
  // Optional link to the responsible clinician (user id). Empty string ⇒ null.
  primaryProviderId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().nullable().optional(),
  ),
  status: z.enum(["active", "inpatient", "discharged"]),
  initials: z.string().trim().min(1).max(4),
  allergies: z.array(allergySchema).default([]),
  alerts: z.array(z.string()).default([]),
  medications: z.array(medicationSchema).default([]),
  problems: z.array(problemSchema).default([]),
  vitals: vitalsSchema,
  vitalsTrend: trendSchema,
  labs: z.array(labSchema).default([]),
  labTrend: trendSchema,
  encounters: z.array(encounterSchema).default([]),
});

export type PatientInput = z.infer<typeof patientInputSchema>;
