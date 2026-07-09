// Patient Portal actions, shared by the public REST kiosk (routes/portal.ts)
// and the relay path used by the wallet app (relay-client.ts handles
// `portal:request` and dispatches here). Both go through the same clinic-scoped
// logic so a booking made in the phone shows up on the clinic's Appointments
// page exactly like a kiosk booking.
//
// The relay path identifies the patient by their *verified* wallet number (the
// relay only forwards a request after the device signed the relay challenge),
// which is more trustworthy than the kiosk's name + file-number check.

import { readFile } from "node:fs/promises";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../db/index.js";
import { member, organization, user } from "../db/schema/auth.js";
import { patients } from "../db/schema/patients.js";
import { staffProfile } from "../db/schema/staff-profile.js";
import { appointmentInputSchema } from "../lib/appointment-validation.js";
import { HttpError } from "../lib/http-error.js";
import { initialsFromName } from "../lib/initials.js";
import { recordActivity } from "./activity.js";
import { createAppointment, listAppointments } from "./appointments.js";
import {
  absolutePath,
  getAttachmentRow,
  listAttachments,
} from "./attachments.js";
import { getPatient } from "./patients.js";

// Clinical-capable roles that can be a patient's provider (mirrors portal.ts).
const PROVIDER_ROLES = ["owner", "admin", "doctor", "member"] as const;

export type PortalDoctor = { name: string; specialty: string | null };

export async function getClinicInfo(orgId: string): Promise<{ name: string }> {
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  if (!org) throw new HttpError(404, "Clinic not found.");
  return { name: org.name };
}

export async function listDoctors(orgId: string): Promise<PortalDoctor[]> {
  const rows = await db
    .select({ name: user.name, specialty: staffProfile.specialty })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      staffProfile,
      and(
        eq(staffProfile.userId, member.userId),
        eq(staffProfile.organizationId, member.organizationId),
      ),
    )
    .where(
      and(
        eq(member.organizationId, orgId),
        inArray(member.role, PROVIDER_ROLES as unknown as string[]),
      ),
    )
    .orderBy(asc(user.name));
  return rows.map((r) => ({ name: r.name, specialty: r.specialty ?? null }));
}

// Taken time slots for a provider on a day, so the client renders only free
// ones. Mirrors routes/portal.ts (an empty-provider appointment blocks the slot
// clinic-wide). Booking re-checks server-side.
export async function getAvailability(
  orgId: string,
  provider: string,
  date: string,
): Promise<{ date: string; provider: string; taken: string[] }> {
  const taken = (await listAppointments(orgId))
    .filter(
      (a) =>
        a.status !== "cancelled" &&
        a.date === date &&
        (!provider || !a.provider || a.provider === provider),
    )
    .map((a) => a.time);
  return { date, provider, taken: [...new Set(taken)].sort() };
}

// --- wallet linkage ---------------------------------------------------------

// Confirm the wallet link for a device. The wallet is identified purely by its
// relay-verified wallet number — the clinic attaches that number to the patient
// file ahead of time (via "Import from a patient app" / QR pairing, which sets
// `patients.walletNumber`), so the device never types a name or file number.
// Resolves the linked file, or a friendly 404 when the clinic hasn't paired yet.
export async function linkWallet(
  orgId: string,
  walletNumber: string,
): Promise<{ fileNumber: string; name: string }> {
  if (!walletNumber) {
    throw new HttpError(400, "Missing wallet identity.");
  }
  const fileNumber = await fileNumberForWallet(orgId, walletNumber);
  if (!fileNumber) {
    throw new HttpError(
      404,
      "This wallet isn't paired with a record at this clinic yet. Ask the front desk to add your wallet number, then try again.",
    );
  }
  const patient = await getPatient(orgId, fileNumber);
  if (!patient) throw new HttpError(404, "Linked record not found.");
  await recordActivity({
    orgId,
    actor: { id: "", name: patient.name },
    action: `Patient portal — ${patient.name} confirmed their wallet link`,
    entityType: "patient",
    entityId: patient.fileNumber,
  });
  return { fileNumber: patient.fileNumber, name: patient.name };
}

// The file number a linked wallet maps to, or null.
export async function fileNumberForWallet(
  orgId: string,
  walletNumber: string,
): Promise<string | null> {
  const [row] = await db
    .select({ fileNumber: patients.fileNumber })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.walletNumber, walletNumber),
      ),
    )
    .limit(1);
  return row?.fileNumber ?? null;
}

async function requireLinkedPatient(orgId: string, walletNumber: string) {
  const fileNumber = await fileNumberForWallet(orgId, walletNumber);
  if (!fileNumber) {
    throw new HttpError(403, "This wallet isn't linked to a record at this clinic.");
  }
  const patient = await getPatient(orgId, fileNumber);
  if (!patient) throw new HttpError(404, "Linked record not found.");
  return patient;
}

// Book an appointment for the linked wallet (conflict-checked), attributed to
// the patient's file so it appears on the clinic's Appointments page.
export async function bookForWallet(
  orgId: string,
  walletNumber: string,
  body: { date: string; time: string; type?: string; provider?: string },
): Promise<{ date: string; time: string; type: string; provider: string }> {
  const patient = await requireLinkedPatient(orgId, walletNumber);

  const today = new Date().toISOString().slice(0, 10);
  if (body.date < today) throw new HttpError(400, "Please pick a future date.");

  const input = appointmentInputSchema.parse({
    fileNumber: patient.fileNumber,
    name: patient.name,
    initials: patient.initials || initialsFromName(patient.name),
    date: body.date,
    time: body.time,
    type: body.type || "Self-service booking",
    provider: body.provider || patient.pcp || "",
    status: "confirmed",
    source: "manual",
  });

  const taken = (await listAppointments(orgId)).some(
    (a) =>
      a.status !== "cancelled" &&
      a.date === input.date &&
      a.time === input.time &&
      (!input.provider || !a.provider || a.provider === input.provider),
  );
  if (taken) {
    throw new HttpError(409, "That time slot is already taken. Please choose another time.");
  }

  const created = await createAppointment(orgId, "", input);
  await recordActivity({
    orgId,
    actor: { id: "", name: patient.name },
    action: `Patient portal booking — ${patient.name} on ${created.date} ${created.time}`,
    entityType: "appointment",
    entityId: created.id,
  });
  return {
    date: created.date,
    time: created.time,
    type: created.type,
    provider: created.provider,
  };
}

// Results view for the linked wallet: upcoming appointments + downloadable lab
// files (metadata only; bytes come from `getResultFile`).
export async function resultsForWallet(
  orgId: string,
  walletNumber: string,
): Promise<{
  name: string;
  upcoming: { date: string; time: string; type: string; provider: string; status: string }[];
  files: { id: string; filename: string; mimeType: string; sizeBytes: number; labKey: string | null }[];
}> {
  const patient = await requireLinkedPatient(orgId, walletNumber);
  const now = new Date();
  const upcoming = (await listAppointments(orgId))
    .filter(
      (a) =>
        a.fileNumber === patient.fileNumber &&
        a.status !== "cancelled" &&
        new Date(`${a.date}T${a.time}`) >= now,
    )
    .map((a) => ({
      date: a.date,
      time: a.time,
      type: a.type,
      provider: a.provider,
      status: a.status,
    }));
  const files = (await listAttachments(orgId, patient.fileNumber)).map((f) => ({
    id: f.id,
    filename: f.filename,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    labKey: f.labKey,
  }));
  return { name: patient.name, upcoming, files };
}

// A single lab/result file for the linked wallet, base64-encoded so it can ride
// back over the relay. Verifies the file belongs to the patient's own record.
export async function resultFileForWallet(
  orgId: string,
  walletNumber: string,
  attachmentId: string,
): Promise<{ filename: string; mimeType: string; base64: string }> {
  const patient = await requireLinkedPatient(orgId, walletNumber);
  const row = await getAttachmentRow(orgId, attachmentId);
  if (!row || row.fileNumber !== patient.fileNumber) {
    throw new HttpError(404, "File not found.");
  }
  const bytes = await readFile(absolutePath(row.storagePath));
  return {
    filename: row.filename,
    mimeType: row.mimeType,
    base64: bytes.toString("base64"),
  };
}

// --- relay dispatch ---------------------------------------------------------

type PortalPayload = Record<string, unknown>;

// Dispatch a `portal:request` relayed from a wallet device. `walletNumber` is
// the device's relay-verified wallet number (empty for the public reads).
export async function handlePortalRequest(
  orgId: string,
  req: { action: string; payload: PortalPayload; walletNumber: string },
): Promise<unknown> {
  const { action, payload, walletNumber } = req;
  const s = (k: string): string => String(payload[k] ?? "");
  switch (action) {
    case "clinic":
      return getClinicInfo(orgId);
    case "doctors":
      return listDoctors(orgId);
    case "availability":
      return getAvailability(orgId, s("provider"), s("date"));
    case "link":
      return linkWallet(orgId, walletNumber);
    case "book":
      return bookForWallet(orgId, walletNumber, {
        date: s("date"),
        time: s("time"),
        type: s("type") || undefined,
        provider: s("provider") || undefined,
      });
    case "results":
      return resultsForWallet(orgId, walletNumber);
    case "result-file":
      return resultFileForWallet(orgId, walletNumber, s("id"));
    default:
      throw new HttpError(400, `Unknown portal action: ${action}`);
  }
}
