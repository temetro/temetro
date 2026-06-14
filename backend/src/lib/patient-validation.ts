import { z } from "zod";

import { initialsFromName } from "./initials.js";

const nonEmpty = z.string().trim().min(1);

const EMPTY_VITALS = { bp: "", hr: "", temp: "", spo2: "", takenAt: "" };
const EMPTY_TREND = { label: "", unit: "", points: [] as number[] };

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
//
// Tolerant by design: an AI import from a sparse export (e.g. just a name) still
// validates. The file number may be empty (the patient service auto-generates
// one), demographics fall back to safe placeholders, initials are derived from
// the name, and the clinical sections default to empty. Such rows are stamped
// `source: "ai"` and surfaced with an "Added by AI" badge for later editing.
export const patientInputSchema = z
  .object({
    fileNumber: z
      .string()
      .trim()
      .regex(/^\d*$/, "File number must be digits")
      .default(""),
    name: nonEmpty,
    age: z.coerce.number().int().min(0).max(150).default(0),
    sex: z.enum(["M", "F"]).default("M"),
    pcp: z.string().default(""),
    // Optional link to the responsible clinician (user id). Empty string ⇒ null.
    primaryProviderId: z.preprocess(
      (v) => (v === "" ? null : v),
      z.string().nullable().optional(),
    ),
    status: z.enum(["active", "inpatient", "discharged"]).default("active"),
    initials: z.string().trim().max(4).default(""),
    allergies: z.array(allergySchema).default([]),
    alerts: z.array(z.string()).default([]),
    medications: z.array(medicationSchema).default([]),
    problems: z.array(problemSchema).default([]),
    vitals: vitalsSchema.default(EMPTY_VITALS),
    vitalsTrend: trendSchema.default(EMPTY_TREND),
    labs: z.array(labSchema).default([]),
    labTrend: trendSchema.default(EMPTY_TREND),
    encounters: z.array(encounterSchema).default([]),
    source: z.enum(["manual", "ai"]).default("manual"),
  })
  .transform((v) => ({
    ...v,
    initials: v.initials || initialsFromName(v.name),
  }));

export type PatientInput = z.infer<typeof patientInputSchema>;
