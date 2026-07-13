import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "../db/index.js";
import { organization } from "../db/schema/auth.js";
import { patients } from "../db/schema/patients.js";
import { walletRecordUpdates } from "../db/schema/wallet-updates.js";
import { walletShareRequests } from "../db/schema/wallet-share.js";
import { HttpError } from "../lib/http-error.js";
import {
  decodeWalletNumber,
  fingerprint,
  seal,
  verifySignature,
} from "../lib/wallet-crypto.js";
import { ed25519PubToX25519Hex } from "../lib/wallet-x25519.js";
import { listAppointments } from "./appointments.js";
import { listAttachments } from "./attachments.js";
import { listInvoices } from "./invoices.js";
import { getPatient } from "./patients.js";
import { signWithClinicKey } from "./signing.js";

type UpdateRow = typeof walletRecordUpdates.$inferSelect;

// The payload the relay pushes to a wallet. `sealed` is the encrypted patient
// snapshot; `signature`/`clinicPublicKey`/`fingerprint` let the wallet verify
// provenance (TOFU pin) before applying.
export type WalletUpdateEvent = {
  requestId: string;
  clinicName: string;
  sealed: string;
  signature: string;
  clinicPublicKey: string;
  fingerprint: string;
  changes: string[];
  createdAt: string;
};

// The clinic-facing view (no ciphertext) for the "Sent updates" list + polling.
export type WalletUpdateView = {
  id: string;
  fileNumber: string;
  walletNumber: string;
  status: UpdateRow["status"];
  changes: string[];
  createdAt: string;
  deliveredAt: string | null;
  resolvedAt: string | null;
};

export function viewOf(row: UpdateRow): WalletUpdateView {
  return toView(row);
}

function toView(row: UpdateRow): WalletUpdateView {
  return {
    id: row.id,
    fileNumber: row.fileNumber,
    walletNumber: row.walletNumber,
    status: row.status,
    changes: row.changes,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

// The wallet number a patient's record is linked to, or null when it isn't
// wallet-backed. Only *permanent, approved, committed* shares qualify —
// temporary shares auto-delete, so pushing an update to them is meaningless.
export async function walletNumberForPatient(
  orgId: string,
  fileNumber: string,
): Promise<string | null> {
  // Preferred: the wallet number the patient linked from the Patient Portal
  // (stored directly on the file). Falls back to a permanent, approved,
  // committed share for records imported the older way.
  const [linked] = await db
    .select({ walletNumber: patients.walletNumber })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, orgId),
        eq(patients.fileNumber, fileNumber),
        isNotNull(patients.walletNumber),
      ),
    )
    .limit(1);
  if (linked?.walletNumber) return linked.walletNumber;

  const [row] = await db
    .select({ walletNumber: walletShareRequests.walletNumber })
    .from(walletShareRequests)
    .where(
      and(
        eq(walletShareRequests.organizationId, orgId),
        eq(walletShareRequests.committedFileNumber, fileNumber),
        eq(walletShareRequests.status, "approved"),
        eq(walletShareRequests.shareMode, "permanent"),
        isNotNull(walletShareRequests.walletNumber),
      ),
    )
    .limit(1);
  return row?.walletNumber ?? null;
}

// Compose, seal and sign a record-update push, and store it as pending. Loads
// the current patient snapshot, seals it to the wallet's derived X25519 key, and
// signs the plaintext bundle with the clinic's Ed25519 key. Returns the row.
export async function createRecordUpdate(
  orgId: string,
  userId: string,
  fileNumber: string,
  changes: string[],
): Promise<UpdateRow> {
  const walletNumber = await walletNumberForPatient(orgId, fileNumber);
  if (!walletNumber) {
    throw new HttpError(409, "This patient is not linked to a wallet.");
  }
  const patient = await getPatient(orgId, fileNumber);
  if (!patient) throw new HttpError(404, "Patient not found.");

  // Appointments and invoices live in their own tables (not on the Patient
  // snapshot), so pull the ones for this patient and ship them alongside — the
  // wallet has no other way to see them and they'd otherwise silently vanish.
  // Attachments (files/documents) are shipped as metadata so the wallet can list
  // them and show a count; the bytes stay on the clinic for now.
  const [orgAppointments, orgInvoices, attachmentRows] = await Promise.all([
    listAppointments(orgId),
    listInvoices(orgId),
    listAttachments(orgId, fileNumber),
  ]);
  const appointments = orgAppointments.filter(
    (a) => a.fileNumber === fileNumber,
  );
  const invoices = orgInvoices.filter((i) => i.fileNumber === fileNumber);
  const documents = attachmentRows.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
  }));

  // The wallet opens this, verifies the signature over the same bytes, then
  // replaces its on-device record with `patient` (+ appointments/invoices/documents).
  const bundle = utf8ToBytes(
    JSON.stringify({ patient, appointments, invoices, documents, changes }),
  );
  const { signature, publicKey } = await signWithClinicKey(orgId, bundle);
  const x25519Hex = ed25519PubToX25519Hex(decodeWalletNumber(walletNumber));
  const sealed = seal(x25519Hex, bundle);

  const [row] = await db
    .insert(walletRecordUpdates)
    .values({
      organizationId: orgId,
      createdBy: userId,
      fileNumber,
      walletNumber,
      payloadSealed: sealed,
      clinicSignature: signature,
      clinicPublicKey: publicKey,
      clinicFingerprint: fingerprint(hexToBytes(publicKey)),
      changes,
    })
    .returning();
  return row!;
}

// Build the wire event for a stored update row (joins the clinic name).
export async function toEvent(row: UpdateRow): Promise<WalletUpdateEvent> {
  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, row.organizationId));
  return {
    requestId: row.id,
    clinicName: org?.name ?? "A clinic",
    sealed: row.payloadSealed,
    signature: row.clinicSignature,
    clinicPublicKey: row.clinicPublicKey,
    fingerprint: row.clinicFingerprint,
    changes: row.changes,
    createdAt: row.createdAt.toISOString(),
  };
}

// Every unresolved update for a wallet — re-sent on each authenticated connect
// so an offline device eventually receives what it missed.
// Pending updates a wallet missed, scoped to one clinic — the relay delivers a
// `wallet:online` over that clinic's own hub connection, so a clinic only ever
// re-sends its *own* updates (never another clinic's).
export async function pendingUpdatesForWallet(
  orgId: string,
  walletNumber: string,
): Promise<UpdateRow[]> {
  return db
    .select()
    .from(walletRecordUpdates)
    .where(
      and(
        eq(walletRecordUpdates.organizationId, orgId),
        eq(walletRecordUpdates.walletNumber, walletNumber),
        isNull(walletRecordUpdates.resolvedAt),
      ),
    )
    .orderBy(walletRecordUpdates.createdAt);
}

// Mark a pending update delivered (best-effort; only advances from pending).
export async function markDelivered(id: string): Promise<void> {
  await db
    .update(walletRecordUpdates)
    .set({ status: "delivered", deliveredAt: new Date() })
    .where(
      and(
        eq(walletRecordUpdates.id, id),
        eq(walletRecordUpdates.status, "pending"),
      ),
    );
}

// Apply the patient's decision relayed back from the wallet. Verifies the
// wallet's Ed25519 signature over `${decision}:${requestId}` (provenance) before
// resolving. Returns the resolved view, or null when unknown/already resolved.
export async function applyUpdateResponse(
  requestId: string,
  walletNumber: string,
  decision: "approved" | "denied",
  signatureHex?: string,
): Promise<WalletUpdateView | null> {
  const [row] = await db
    .select()
    .from(walletRecordUpdates)
    .where(eq(walletRecordUpdates.id, requestId));
  if (!row || row.resolvedAt) return null;
  if (row.walletNumber !== walletNumber.trim()) return null;
  if (!signatureHex) return null;

  const publicKey = decodeWalletNumber(walletNumber);
  const message = utf8ToBytes(`${decision}:${requestId}`);
  if (!verifySignature(publicKey, signatureHex, message)) {
    throw new HttpError(400, "Response signature did not match the wallet.");
  }

  const [updated] = await db
    .update(walletRecordUpdates)
    .set({ status: decision, resolvedAt: new Date() })
    .where(eq(walletRecordUpdates.id, requestId))
    .returning();
  return updated ? toView(updated) : null;
}

// Recent update pushes for the clinic (Signing panel "Sent updates" list).
export async function listUpdates(
  orgId: string,
  limit = 30,
): Promise<WalletUpdateView[]> {
  const rows = await db
    .select()
    .from(walletRecordUpdates)
    .where(eq(walletRecordUpdates.organizationId, orgId))
    .orderBy(desc(walletRecordUpdates.createdAt))
    .limit(limit);
  return rows.map(toView);
}

export async function getUpdate(
  orgId: string,
  id: string,
): Promise<WalletUpdateView | null> {
  const [row] = await db
    .select()
    .from(walletRecordUpdates)
    .where(
      and(
        eq(walletRecordUpdates.id, id),
        eq(walletRecordUpdates.organizationId, orgId),
      ),
    );
  return row ? toView(row) : null;
}
