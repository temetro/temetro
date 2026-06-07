import { and, asc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { appointments } from "../db/schema/appointments.js";
import type { AppointmentInput } from "../lib/appointment-validation.js";
import type { Appointment } from "../types/appointment.js";

type AppointmentRow = typeof appointments.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    fileNumber: row.patientFileNumber,
    name: row.patientName,
    initials: row.patientInitials,
    date: row.date,
    time: row.time,
    type: row.type,
    provider: row.provider,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function columns(orgId: string, input: AppointmentInput, createdBy?: string) {
  return {
    organizationId: orgId,
    patientFileNumber: input.fileNumber,
    patientName: input.name,
    patientInitials: input.initials,
    date: input.date,
    time: input.time,
    type: input.type,
    provider: input.provider,
    status: input.status,
    ...(createdBy ? { createdBy } : {}),
  };
}

export async function listAppointments(orgId: string): Promise<Appointment[]> {
  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.organizationId, orgId))
    .orderBy(asc(appointments.date), asc(appointments.time));
  return rows.map(toAppointment);
}

export async function createAppointment(
  orgId: string,
  userId: string,
  input: AppointmentInput,
): Promise<Appointment> {
  const [row] = await db
    .insert(appointments)
    .values(columns(orgId, input, userId))
    .returning();
  return toAppointment(row!);
}

export async function updateAppointment(
  orgId: string,
  id: string,
  input: AppointmentInput,
): Promise<Appointment | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .update(appointments)
    .set(columns(orgId, input))
    .where(
      and(eq(appointments.id, id), eq(appointments.organizationId, orgId)),
    )
    .returning();
  return row ? toAppointment(row) : null;
}

export async function deleteAppointment(
  orgId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(appointments)
    .where(
      and(eq(appointments.id, id), eq(appointments.organizationId, orgId)),
    )
    .returning({ id: appointments.id });
  return deleted.length > 0;
}
