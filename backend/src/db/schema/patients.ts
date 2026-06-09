import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  AllergySeverity,
  LabFlag,
  PatientStatus,
  Sex,
  Trend,
} from "../../types/patient.js";
import { organization, user } from "./auth.js";

// One row per patient, scoped to a clinic (organization). `fileNumber` (MRN)
// is the chat lookup key and is unique within an organization. Current vitals
// live as columns; the two headline sparkline series and the freeform alert
// list are stored as JSONB. Child collections are separate tables below.
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fileNumber: text("file_number").notNull(),
    name: text("name").notNull(),
    age: integer("age").notNull(),
    sex: text("sex").$type<Sex>().notNull(),
    pcp: text("pcp").notNull(),
    status: text("status").$type<PatientStatus>().notNull(),
    initials: text("initials").notNull(),
    alerts: jsonb("alerts").$type<string[]>().notNull(),
    vitalsBp: text("vitals_bp").notNull(),
    vitalsHr: text("vitals_hr").notNull(),
    vitalsTemp: text("vitals_temp").notNull(),
    vitalsSpo2: text("vitals_spo2").notNull(),
    vitalsTakenAt: text("vitals_taken_at").notNull(),
    vitalsTrend: jsonb("vitals_trend").$type<Trend>().notNull(),
    labTrend: jsonb("lab_trend").$type<Trend>().notNull(),
    // The clinician responsible for this chart (the patient's "PCP"). Used to
    // scope what each doctor sees and to transfer a patient between providers.
    // Nullable: legacy/unassigned rows and patients registered by reception.
    primaryProviderId: text("primary_provider_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("patients_org_file_uidx").on(t.organizationId, t.fileNumber),
    index("patients_org_idx").on(t.organizationId),
  ],
);

export const allergies = pgTable(
  "patient_allergies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    substance: text("substance").notNull(),
    reaction: text("reaction").notNull(),
    severity: text("severity").$type<AllergySeverity>().notNull(),
  },
  (t) => [index("allergies_patient_idx").on(t.patientId)],
);

export const medications = pgTable(
  "patient_medications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    dose: text("dose").notNull(),
    frequency: text("frequency").notNull(),
  },
  (t) => [index("medications_patient_idx").on(t.patientId)],
);

export const problems = pgTable(
  "patient_problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    label: text("label").notNull(),
    since: text("since").notNull(),
  },
  (t) => [index("problems_patient_idx").on(t.patientId)],
);

export const labs = pgTable(
  "patient_labs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    value: text("value").notNull(),
    flag: text("flag").$type<LabFlag>().notNull(),
    takenAt: text("taken_at").notNull(),
  },
  (t) => [index("labs_patient_idx").on(t.patientId)],
);

export const encounters = pgTable(
  "patient_encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    date: text("date").notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    summary: text("summary").notNull(),
  },
  (t) => [index("encounters_patient_idx").on(t.patientId)],
);

export const patientChildTables = {
  allergies,
  medications,
  problems,
  labs,
  encounters,
} as const;
