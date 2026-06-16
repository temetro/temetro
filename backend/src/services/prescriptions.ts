import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { prescriptions } from "../db/schema/prescriptions.js";
import type { PrescriptionInput } from "../lib/prescription-validation.js";
import type { Prescription } from "../types/prescription.js";

type PrescriptionRow = typeof prescriptions.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPrescription(row: PrescriptionRow): Prescription {
  return {
    id: row.id,
    fileNumber: row.patientFileNumber,
    name: row.patientName,
    initials: row.patientInitials,
    medication: row.medication,
    dose: row.dose,
    frequency: row.frequency,
    prescriber: row.prescriber,
    prescribedAt: row.prescribedAt,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    duration: row.duration,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function columns(orgId: string, input: PrescriptionInput, createdBy?: string) {
  return {
    organizationId: orgId,
    patientFileNumber: input.fileNumber,
    patientName: input.name,
    patientInitials: input.initials,
    medication: input.medication,
    dose: input.dose,
    frequency: input.frequency,
    prescriber: input.prescriber,
    status: input.status,
    duration: input.duration ?? null,
    notes: input.notes ?? null,
    source: input.source,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    // Only set prescribedAt when supplied; otherwise the column default (today).
    ...(input.prescribedAt ? { prescribedAt: input.prescribedAt } : {}),
    ...(createdBy ? { createdBy } : {}),
  };
}

export async function listPrescriptions(
  orgId: string,
): Promise<Prescription[]> {
  const rows = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.organizationId, orgId))
    .orderBy(desc(prescriptions.prescribedAt), desc(prescriptions.createdAt));
  return rows.map(toPrescription);
}

export async function createPrescription(
  orgId: string,
  userId: string,
  input: PrescriptionInput,
): Promise<Prescription> {
  const [row] = await db
    .insert(prescriptions)
    .values(columns(orgId, input, userId))
    .returning();
  return toPrescription(row!);
}

export async function updatePrescription(
  orgId: string,
  id: string,
  input: PrescriptionInput,
): Promise<Prescription | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .update(prescriptions)
    .set(columns(orgId, input))
    .where(
      and(eq(prescriptions.id, id), eq(prescriptions.organizationId, orgId)),
    )
    .returning();
  return row ? toPrescription(row) : null;
}

export async function deletePrescription(
  orgId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(prescriptions)
    .where(
      and(eq(prescriptions.id, id), eq(prescriptions.organizationId, orgId)),
    )
    .returning({ id: prescriptions.id });
  return deleted.length > 0;
}
