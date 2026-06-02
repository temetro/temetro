import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";
import {
  allergies,
  encounters,
  labs,
  medications,
  patients,
  problems,
} from "../db/schema/patients.js";
import { HttpError } from "../lib/http-error.js";
import type { PatientInput } from "../lib/patient-validation.js";
import type {
  Allergy,
  Encounter,
  Lab,
  Medication,
  Patient,
  Problem,
} from "../types/patient.js";

type PatientRow = typeof patients.$inferSelect;

type Children = {
  allergies: Allergy[];
  medications: Medication[];
  problems: Problem[];
  labs: Lab[];
  encounters: Encounter[];
};

const emptyChildren = (): Children => ({
  allergies: [],
  medications: [],
  problems: [],
  labs: [],
  encounters: [],
});

function toPatient(row: PatientRow, children: Children): Patient {
  return {
    fileNumber: row.fileNumber,
    name: row.name,
    age: row.age,
    sex: row.sex,
    pcp: row.pcp,
    status: row.status,
    initials: row.initials,
    allergies: children.allergies,
    alerts: row.alerts,
    medications: children.medications,
    problems: children.problems,
    vitals: {
      bp: row.vitalsBp,
      hr: row.vitalsHr,
      temp: row.vitalsTemp,
      spo2: row.vitalsSpo2,
      takenAt: row.vitalsTakenAt,
    },
    vitalsTrend: row.vitalsTrend,
    labs: children.labs,
    labTrend: row.labTrend,
    encounters: children.encounters,
  };
}

// Input children are already in the canonical Patient sub-shapes.
function childrenFromInput(input: PatientInput): Children {
  return {
    allergies: input.allergies,
    medications: input.medications,
    problems: input.problems,
    labs: input.labs,
    encounters: input.encounters,
  };
}

function patientColumns(orgId: string, input: PatientInput, createdBy?: string) {
  return {
    organizationId: orgId,
    fileNumber: input.fileNumber,
    name: input.name,
    age: input.age,
    sex: input.sex,
    pcp: input.pcp,
    status: input.status,
    initials: input.initials,
    alerts: input.alerts,
    vitalsBp: input.vitals.bp,
    vitalsHr: input.vitals.hr,
    vitalsTemp: input.vitals.temp,
    vitalsSpo2: input.vitals.spo2,
    vitalsTakenAt: input.vitals.takenAt,
    vitalsTrend: input.vitalsTrend,
    labTrend: input.labTrend,
    ...(createdBy ? { createdBy } : {}),
  };
}

// Loads and groups child rows for a set of patients in one round-trip each.
async function loadChildren(
  patientIds: string[],
): Promise<Map<string, Children>> {
  const grouped = new Map<string, Children>();
  for (const id of patientIds) grouped.set(id, emptyChildren());
  if (patientIds.length === 0) return grouped;

  const [al, me, pr, la, en] = await Promise.all([
    db
      .select()
      .from(allergies)
      .where(inArray(allergies.patientId, patientIds))
      .orderBy(asc(allergies.position)),
    db
      .select()
      .from(medications)
      .where(inArray(medications.patientId, patientIds))
      .orderBy(asc(medications.position)),
    db
      .select()
      .from(problems)
      .where(inArray(problems.patientId, patientIds))
      .orderBy(asc(problems.position)),
    db
      .select()
      .from(labs)
      .where(inArray(labs.patientId, patientIds))
      .orderBy(asc(labs.position)),
    db
      .select()
      .from(encounters)
      .where(inArray(encounters.patientId, patientIds))
      .orderBy(asc(encounters.position)),
  ]);

  for (const a of al)
    grouped.get(a.patientId)?.allergies.push({
      substance: a.substance,
      reaction: a.reaction,
      severity: a.severity,
    });
  for (const m of me)
    grouped.get(m.patientId)?.medications.push({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
    });
  for (const p of pr)
    grouped.get(p.patientId)?.problems.push({ label: p.label, since: p.since });
  for (const l of la)
    grouped.get(l.patientId)?.labs.push({
      name: l.name,
      value: l.value,
      flag: l.flag,
      takenAt: l.takenAt,
    });
  for (const e of en)
    grouped.get(e.patientId)?.encounters.push({
      date: e.date,
      type: e.type,
      provider: e.provider,
      summary: e.summary,
    });

  return grouped;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertChildren(
  tx: Tx,
  patientId: string,
  input: PatientInput,
): Promise<void> {
  if (input.allergies.length)
    await tx
      .insert(allergies)
      .values(input.allergies.map((a, i) => ({ patientId, position: i, ...a })));
  if (input.medications.length)
    await tx
      .insert(medications)
      .values(
        input.medications.map((m, i) => ({ patientId, position: i, ...m })),
      );
  if (input.problems.length)
    await tx
      .insert(problems)
      .values(input.problems.map((p, i) => ({ patientId, position: i, ...p })));
  if (input.labs.length)
    await tx
      .insert(labs)
      .values(input.labs.map((l, i) => ({ patientId, position: i, ...l })));
  if (input.encounters.length)
    await tx
      .insert(encounters)
      .values(
        input.encounters.map((e, i) => ({ patientId, position: i, ...e })),
      );
}

function isUniqueViolation(err: unknown): boolean {
  // drizzle wraps the driver error, so the pg error code (23505) may sit on
  // the error itself or on its `cause`.
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "23505",
  );
}

export async function listPatients(orgId: string): Promise<Patient[]> {
  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.organizationId, orgId))
    .orderBy(asc(patients.name));
  const children = await loadChildren(rows.map((r) => r.id));
  return rows.map((r) => toPatient(r, children.get(r.id) ?? emptyChildren()));
}

export async function getPatient(
  orgId: string,
  fileNumber: string,
): Promise<Patient | null> {
  const [row] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
      ),
    );
  if (!row) return null;
  const children = await loadChildren([row.id]);
  return toPatient(row, children.get(row.id) ?? emptyChildren());
}

export async function createPatient(
  orgId: string,
  userId: string,
  input: PatientInput,
): Promise<Patient> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(patients)
        .values(patientColumns(orgId, input, userId))
        .returning();
      await insertChildren(tx, row!.id, input);
      return toPatient(row!, childrenFromInput(input));
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(
        409,
        `A patient with file number ${input.fileNumber} already exists in this clinic.`,
      );
    }
    throw err;
  }
}

export async function updatePatient(
  orgId: string,
  fileNumber: string,
  input: PatientInput,
): Promise<Patient | null> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.organizationId, orgId),
            eq(patients.fileNumber, fileNumber),
          ),
        );
      if (!existing) return null;

      const [row] = await tx
        .update(patients)
        .set(patientColumns(orgId, input))
        .where(eq(patients.id, existing.id))
        .returning();

      // Replace child collections wholesale (form submits the full record).
      await Promise.all([
        tx.delete(allergies).where(eq(allergies.patientId, existing.id)),
        tx.delete(medications).where(eq(medications.patientId, existing.id)),
        tx.delete(problems).where(eq(problems.patientId, existing.id)),
        tx.delete(labs).where(eq(labs.patientId, existing.id)),
        tx.delete(encounters).where(eq(encounters.patientId, existing.id)),
      ]);
      await insertChildren(tx, existing.id, input);

      return toPatient(row!, childrenFromInput(input));
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(
        409,
        `A patient with file number ${input.fileNumber} already exists in this clinic.`,
      );
    }
    throw err;
  }
}

export async function deletePatient(
  orgId: string,
  fileNumber: string,
): Promise<boolean> {
  const deleted = await db
    .delete(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
      ),
    )
    .returning({ id: patients.id });
  return deleted.length > 0;
}
