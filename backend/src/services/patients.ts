import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

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
import {
  patientInputSchema,
  type PatientInput,
} from "../lib/patient-validation.js";
import type {
  Allergy,
  Encounter,
  Lab,
  Medication,
  Patient,
  Problem,
  Trend,
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
    primaryProviderId: row.primaryProviderId,
    status: row.status,
    initials: row.initials,
    phone: row.phone,
    bloodType: row.bloodType,
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
    source: row.source,
    shareExpiresAt: row.shareExpiresAt ? row.shareExpiresAt.toISOString() : null,
  };
}

const EMPTY_TREND: Trend = { label: "", unit: "", points: [] };

// Strip every clinical section, leaving only registration/demographic fields.
// Used for the `reception` role, which is scoped to scheduling + registration
// and must never receive PHI (labs, meds, problems, vitals, encounters). This
// enforces least-privilege server-side rather than relying on the UI to hide it.
function redactClinical(patient: Patient): Patient {
  return {
    ...patient,
    // bloodType is clinical PHI; phone is a demographic/contact field and stays.
    bloodType: "",
    allergies: [],
    alerts: [],
    medications: [],
    problems: [],
    vitals: { bp: "", hr: "", temp: "", spo2: "", takenAt: "" },
    vitalsTrend: EMPTY_TREND,
    labs: [],
    labTrend: EMPTY_TREND,
    encounters: [],
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
    primaryProviderId: input.primaryProviderId ?? null,
    status: input.status,
    initials: input.initials,
    phone: input.phone,
    bloodType: input.bloodType,
    alerts: input.alerts,
    vitalsBp: input.vitals.bp,
    vitalsHr: input.vitals.hr,
    vitalsTemp: input.vitals.temp,
    vitalsSpo2: input.vitals.spo2,
    vitalsTakenAt: input.vitals.takenAt,
    vitalsTrend: input.vitalsTrend,
    labTrend: input.labTrend,
    source: input.source,
    ...(createdBy ? { createdBy } : {}),
  };
}

// Registration columns only — clinical columns get empty values (they are
// NOT NULL). Used when the `reception` role creates a patient so they can never
// write PHI even if the request body contains clinical fields.
function demographicColumns(
  orgId: string,
  input: PatientInput,
  createdBy?: string,
) {
  return {
    organizationId: orgId,
    fileNumber: input.fileNumber,
    name: input.name,
    age: input.age,
    sex: input.sex,
    pcp: input.pcp,
    primaryProviderId: input.primaryProviderId ?? null,
    status: input.status,
    initials: input.initials,
    phone: input.phone,
    bloodType: "",
    source: input.source,
    alerts: [] as string[],
    vitalsBp: "",
    vitalsHr: "",
    vitalsTemp: "",
    vitalsSpo2: "",
    vitalsTakenAt: "",
    vitalsTrend: EMPTY_TREND,
    labTrend: EMPTY_TREND,
    ...(createdBy ? { createdBy } : {}),
  };
}

// The demographic subset for a `reception` update — never touches clinical
// columns or child tables, so an existing record's PHI is preserved.
function demographicUpdateColumns(input: PatientInput) {
  return {
    fileNumber: input.fileNumber,
    name: input.name,
    age: input.age,
    sex: input.sex,
    pcp: input.pcp,
    primaryProviderId: input.primaryProviderId ?? null,
    status: input.status,
    initials: input.initials,
    phone: input.phone,
  };
}

// Scope clinical reads to a single provider's panel: their own patients plus any
// legacy/unassigned rows they created (so a freshly scoped doctor isn't left
// with an empty list). Returns undefined when no scoping should apply.
function providerScopeFilter(providerId?: string): SQL | undefined {
  if (!providerId) return undefined;
  return or(
    eq(patients.primaryProviderId, providerId),
    and(isNull(patients.primaryProviderId), eq(patients.createdBy, providerId)),
  );
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

// Pick the next free numeric file number for an org (max existing digit-only
// file number + 1, floored at 10000). Used when an AI import omits one. The
// unique index still guards against a race, surfacing a 409.
export async function generateFileNumber(orgId: string): Promise<string> {
  const [r] = await db
    .select({
      max: sql<number>`coalesce(max((${patients.fileNumber})::bigint), 9999)`,
    })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        sql`${patients.fileNumber} ~ '^[0-9]+$'`,
      ),
    );
  return String(Number(r?.max ?? 9999) + 1);
}

// Resolve the file number to attach a denormalized record (e.g. an appointment)
// to a patient. With a file number, use it as-is. Without one (AI-imported rows),
// reuse an existing same-name patient when present — deduping repeat rows and
// re-imports — otherwise create a minimal patient (auto file number, source "ai")
// so they appear on the Patients page. Returns the file number to link.
export async function ensurePatient(
  orgId: string,
  userId: string,
  patient: { fileNumber: string; name: string; initials: string },
): Promise<string> {
  if (patient.fileNumber) return patient.fileNumber;
  const [existing] = await db
    .select({ fileNumber: patients.fileNumber })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.name, patient.name),
      ),
    )
    .limit(1);
  if (existing) return existing.fileNumber;
  const created = await createPatient(
    orgId,
    userId,
    patientInputSchema.parse({
      name: patient.name,
      initials: patient.initials,
      source: "ai",
    }),
  );
  return created.fileNumber;
}

export async function listPatients(
  orgId: string,
  demographicsOnly = false,
  providerId?: string,
): Promise<Patient[]> {
  const scope = providerScopeFilter(providerId);
  const rows = await db
    .select()
    .from(patients)
    .where(
      scope ? and(eq(patients.organizationId, orgId), scope) : eq(patients.organizationId, orgId),
    )
    .orderBy(asc(patients.name));
  const children = await loadChildren(rows.map((r) => r.id));
  return rows.map((r) => {
    const patient = toPatient(r, children.get(r.id) ?? emptyChildren());
    return demographicsOnly ? redactClinical(patient) : patient;
  });
}

export async function getPatient(
  orgId: string,
  fileNumber: string,
  demographicsOnly = false,
  providerId?: string,
): Promise<Patient | null> {
  const scope = providerScopeFilter(providerId);
  const [row] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
        ...(scope ? [scope] : []),
      ),
    );
  if (!row) return null;
  const children = await loadChildren([row.id]);
  const patient = toPatient(row, children.get(row.id) ?? emptyChildren());
  return demographicsOnly ? redactClinical(patient) : patient;
}

// Reassign a patient to another clinician. Updates both the machine link
// (primaryProviderId — drives per-doctor visibility) and the display string
// (pcp). Org-scoped; returns null when the patient isn't in this clinic.
export async function transferPatient(
  orgId: string,
  fileNumber: string,
  providerId: string,
  providerName: string,
  scopeProviderId?: string,
): Promise<Patient | null> {
  const scope = providerScopeFilter(scopeProviderId);
  const [row] = await db
    .update(patients)
    .set({ primaryProviderId: providerId, pcp: providerName })
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
        ...(scope ? [scope] : []),
      ),
    )
    .returning();
  if (!row) return null;
  const children = await loadChildren([row.id]);
  return toPatient(row, children.get(row.id) ?? emptyChildren());
}

export async function createPatient(
  orgId: string,
  userId: string,
  rawInput: PatientInput,
  demographicsOnly = false,
  // Extra columns set on import from a patient wallet (provenance + the
  // auto-delete deadline for a temporary share).
  extra?: { shareOrigin?: "wallet" | null; shareExpiresAt?: Date | null },
): Promise<Patient> {
  // Auto-assign a file number when one wasn't supplied (e.g. AI imports).
  const input: PatientInput = rawInput.fileNumber
    ? rawInput
    : { ...rawInput, fileNumber: await generateFileNumber(orgId) };
  try {
    return await db.transaction(async (tx) => {
      // Reception registers demographics only — clinical input is ignored and
      // no child (clinical) rows are written.
      if (demographicsOnly) {
        const [row] = await tx
          .insert(patients)
          .values({ ...demographicColumns(orgId, input, userId), ...extra })
          .returning();
        return toPatient(row!, emptyChildren());
      }
      const [row] = await tx
        .insert(patients)
        .values({ ...patientColumns(orgId, input, userId), ...extra })
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
  demographicsOnly = false,
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

      // Reception edits demographics only: update the registration columns and
      // leave clinical columns + child tables (existing PHI) untouched, then
      // return a redacted record.
      if (demographicsOnly) {
        const [row] = await tx
          .update(patients)
          .set(demographicUpdateColumns(input))
          .where(eq(patients.id, existing.id))
          .returning();
        const children = await loadChildren([existing.id]);
        return redactClinical(
          toPatient(row!, children.get(existing.id) ?? emptyChildren()),
        );
      }

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

// Append lab results without touching the rest of the record — lab staff hold
// `lab:write`, not `patient:write`, so they must not go through updatePatient's
// wholesale child replacement. Positions continue after the current max so the
// new rows sort last.
export async function appendLabs(
  orgId: string,
  fileNumber: string,
  entries: Lab[],
): Promise<Patient | null> {
  const inserted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organizationId, orgId),
          eq(patients.fileNumber, fileNumber),
        ),
      );
    if (!existing) return false;

    const [pos] = await tx
      .select({ max: sql<number>`coalesce(max(${labs.position}), -1)` })
      .from(labs)
      .where(eq(labs.patientId, existing.id));
    await tx.insert(labs).values(
      entries.map((lab, i) => ({
        patientId: existing.id,
        position: (pos?.max ?? -1) + 1 + i,
        ...lab,
      })),
    );
    await tx
      .update(patients)
      .set({ updatedAt: new Date() })
      .where(eq(patients.id, existing.id));
    return true;
  });
  if (!inserted) return null;
  // Reload after commit — loadChildren queries via the non-tx `db` client.
  return getPatient(orgId, fileNumber);
}

// Append a single encounter (visit note) without touching the rest of the
// record — used by the ambient AI scribe, which drafts one note at a time and
// must not go through updatePatient's wholesale child replacement. Position
// continues after the current max so the new note sorts last.
export async function appendEncounter(
  orgId: string,
  fileNumber: string,
  entry: Encounter,
): Promise<Patient | null> {
  const inserted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organizationId, orgId),
          eq(patients.fileNumber, fileNumber),
        ),
      );
    if (!existing) return false;

    const [pos] = await tx
      .select({ max: sql<number>`coalesce(max(${encounters.position}), -1)` })
      .from(encounters)
      .where(eq(encounters.patientId, existing.id));
    await tx.insert(encounters).values({
      patientId: existing.id,
      position: (pos?.max ?? -1) + 1,
      ...entry,
    });
    await tx
      .update(patients)
      .set({ updatedAt: new Date() })
      .where(eq(patients.id, existing.id));
    return true;
  });
  if (!inserted) return null;
  return getPatient(orgId, fileNumber);
}

// Remove a single lab result from a patient, identified by its
// name/value/takenAt (the frontend has no row id). Scoped to the org via the
// owning patient. Returns the reloaded patient, or null when the chart is gone.
export async function deleteLab(
  orgId: string,
  fileNumber: string,
  match: { name: string; value: string; takenAt: string },
): Promise<Patient | null> {
  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
      ),
    );
  if (!existing) return null;
  await db
    .delete(labs)
    .where(
      and(
        eq(labs.patientId, existing.id),
        eq(labs.name, match.name),
        eq(labs.value, match.value),
        eq(labs.takenAt, match.takenAt),
      ),
    );
  await db
    .update(patients)
    .set({ updatedAt: new Date() })
    .where(eq(patients.id, existing.id));
  return getPatient(orgId, fileNumber);
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
