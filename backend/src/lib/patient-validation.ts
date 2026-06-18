import { z } from "zod";

import { initialsFromName } from "./initials.js";

const nonEmpty = z.string().trim().min(1);

const EMPTY_VITALS = { bp: "", hr: "", temp: "", spo2: "", takenAt: "" };
const EMPTY_TREND = { label: "", unit: "", points: [] as number[] };

// Coerce a bare string into an object keyed on its primary field, so a sparse
// export ("Penicillin", "Metformin") still validates — both the AI import and
// the patient form benefit. Real objects pass through untouched.
const stringToObject = (key: string) => (value: unknown) =>
  typeof value === "string" ? { [key]: value } : value;

export const allergySchema = z.preprocess(
  stringToObject("substance"),
  z.object({
    substance: nonEmpty,
    reaction: z.string().default(""),
    severity: z.enum(["mild", "moderate", "severe"]).default("mild"),
  }),
);

export const medicationSchema = z.preprocess(
  stringToObject("name"),
  z.object({
    name: nonEmpty,
    dose: z.string().default(""),
    frequency: z.string().default(""),
  }),
);

export const problemSchema = z.preprocess(
  stringToObject("label"),
  z.object({
    label: nonEmpty,
    since: z.string().default(""),
  }),
);

export const labSchema = z.object({
  name: nonEmpty,
  value: nonEmpty,
  flag: z.enum(["normal", "high", "low", "critical"]).default("normal"),
  takenAt: z.string().default(""),
});

export const encounterSchema = z.object({
  date: z.string().default(""),
  // A visit row always has a department/type, but never let it be empty.
  type: z
    .string()
    .default("")
    .transform((s) => s.trim() || "Visit"),
  provider: z.string().default(""),
  summary: z.string().default(""),
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
    // Real-world exports use IDs like "P00001"; keep only the digits (empty ⇒
    // the patient service auto-generates one). Never reject on stray letters.
    fileNumber: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
      z.string().trim().default(""),
    ),
    name: nonEmpty,
    age: z.coerce.number().int().min(0).max(150).default(0),
    // Accept gender words (Male / female / man / F / …), not just M/F.
    sex: z.preprocess((v) => {
      if (typeof v !== "string") return v;
      const s = v.trim().toLowerCase();
      if (s.startsWith("m")) return "M";
      if (s.startsWith("f") || s.startsWith("w")) return "F";
      return v;
    }, z.enum(["M", "F"]).default("M")),
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
