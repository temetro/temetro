import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "../../db/index.js";
import { appointments } from "../../db/schema/appointments.js";
import {
  allergies,
  encounters,
  labs,
  medications,
  patients,
  problems,
} from "../../db/schema/patients.js";
import { prescriptions } from "../../db/schema/prescriptions.js";

// Narrow, org-scoped reads for the FHIR server. Deliberately separate from the
// app's `services/patients.ts` (which returns the reshaped canonical Patient and
// applies role redaction): the FHIR layer needs raw rows *with their UUIDs* to
// mint stable resource ids, and offset/limit pagination the app service doesn't
// expose. Every function is scoped to a single organization.

export type PatientRow = typeof patients.$inferSelect;
export type LabRow = typeof labs.$inferSelect;
export type AllergyRow = typeof allergies.$inferSelect;
export type ProblemRow = typeof problems.$inferSelect;
export type EncounterRow = typeof encounters.$inferSelect;
export type PrescriptionRow = typeof prescriptions.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;

// --- Patient ----------------------------------------------------------------

// Paginated Patient search. `identifier` matches the MRN (file number) exactly;
// `name` is a case-insensitive substring. Returns the page plus the full total
// for the searchset Bundle.
export async function searchPatients(
  orgId: string,
  opts: { identifier?: string; name?: string; limit: number; offset: number },
): Promise<{ rows: PatientRow[]; total: number }> {
  const filters: SQL[] = [eq(patients.organizationId, orgId)];
  if (opts.identifier) filters.push(eq(patients.fileNumber, opts.identifier));
  if (opts.name) filters.push(ilike(patients.name, `%${opts.name}%`));
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(where)
      .orderBy(asc(patients.fileNumber))
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ value: count() }).from(patients).where(where),
  ]);

  return { rows, total: totalRow?.value ?? 0 };
}

// A single patient by FHIR logical id (the row UUID), scoped to the org.
export async function patientById(
  orgId: string,
  id: string,
): Promise<PatientRow | undefined> {
  // Guard against a non-UUID id: Postgres would otherwise error on the cast.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.organizationId, orgId), eq(patients.id, id)))
    .limit(1);
  return row;
}

// Resolve a `patient` search parameter to a patient row. Accepts either the FHIR
// logical id (`patient=<uuid>`) or the MRN (`patient.identifier=<file#>`).
export async function resolvePatientRef(
  orgId: string,
  ref: { patientId?: string; identifier?: string },
): Promise<PatientRow | undefined> {
  if (ref.patientId) {
    // A reference may arrive as "Patient/<id>" or a bare id.
    const id = ref.patientId.replace(/^Patient\//, "");
    return patientById(orgId, id);
  }
  if (ref.identifier) {
    const [row] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.organizationId, orgId),
          eq(patients.fileNumber, ref.identifier),
        ),
      )
      .limit(1);
    return row;
  }
  return undefined;
}

// --- Clinical child rows (by patient UUID) ----------------------------------

export function labsForPatient(patientId: string): Promise<LabRow[]> {
  return db
    .select()
    .from(labs)
    .where(eq(labs.patientId, patientId))
    .orderBy(asc(labs.position));
}

export function allergiesForPatient(patientId: string): Promise<AllergyRow[]> {
  return db
    .select()
    .from(allergies)
    .where(eq(allergies.patientId, patientId))
    .orderBy(asc(allergies.position));
}

export function problemsForPatient(patientId: string): Promise<ProblemRow[]> {
  return db
    .select()
    .from(problems)
    .where(eq(problems.patientId, patientId))
    .orderBy(asc(problems.position));
}

export function encountersForPatient(
  patientId: string,
): Promise<EncounterRow[]> {
  return db
    .select()
    .from(encounters)
    .where(eq(encounters.patientId, patientId))
    .orderBy(asc(encounters.position));
}

// --- Denormalized resources (linked to the patient by MRN / file number) ----

export function prescriptionsForFile(
  orgId: string,
  fileNumber: string,
): Promise<PrescriptionRow[]> {
  return db
    .select()
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.organizationId, orgId),
        eq(prescriptions.patientFileNumber, fileNumber),
      ),
    )
    .orderBy(sql`${prescriptions.prescribedAt} desc`);
}

export function appointmentsForFile(
  orgId: string,
  fileNumber: string,
): Promise<AppointmentRow[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, orgId),
        eq(appointments.patientFileNumber, fileNumber),
      ),
    )
    .orderBy(sql`${appointments.date} desc, ${appointments.time} desc`);
}
