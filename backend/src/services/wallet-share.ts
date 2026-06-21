import { utf8ToBytes } from "@noble/hashes/utils.js";
import { and, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "../db/index.js";
import { patients } from "../db/schema/patients.js";
import {
  walletShareRequests,
  type WalletShareMode,
} from "../db/schema/wallet-share.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { HttpError } from "../lib/http-error.js";
import {
  decodeWalletNumber,
  newEncryptionKeypair,
  open,
  verifySignature,
} from "../lib/wallet-crypto.js";
import type { Patient } from "../types/patient.js";
import { recordActivity } from "./activity.js";
import { deletePatient } from "./patients.js";

type ShareRow = typeof walletShareRequests.$inferSelect;

export type ShareRequestView = {
  id: string;
  walletNumber: string;
  status: ShareRow["status"];
  shareMode: WalletShareMode;
  shareExpiresAt: string | null;
  draft: Patient | null;
};

function toView(row: ShareRow): ShareRequestView {
  return {
    id: row.id,
    walletNumber: row.walletNumber,
    status: row.status,
    shareMode: row.shareMode,
    shareExpiresAt: row.shareExpiresAt ? row.shareExpiresAt.toISOString() : null,
    draft: row.draft ?? null,
  };
}

// Create an import request: validate the wallet number, mint a per-request
// ephemeral X25519 keypair (the phone seals the bundle to its public key) and
// store the request. Returns the row + the ephemeral public key to relay to the
// device. Throws 400 on a malformed wallet number.
export async function createShareRequest(
  orgId: string,
  userId: string,
  walletNumber: string,
  mode: WalletShareMode,
  durationHours?: number,
): Promise<{ view: ShareRequestView; ephemeralPubKey: string }> {
  try {
    decodeWalletNumber(walletNumber);
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
  const { privateKeyHex, publicKeyHex } = newEncryptionKeypair();
  const shareExpiresAt =
    mode === "temporary" && durationHours
      ? new Date(Date.now() + durationHours * 3_600_000)
      : null;
  const [row] = await db
    .insert(walletShareRequests)
    .values({
      organizationId: orgId,
      requestedBy: userId,
      walletNumber: walletNumber.trim(),
      ephemeralPubKey: publicKeyHex,
      ephemeralPrivEnc: encryptSecret(privateKeyHex),
      shareMode: mode,
      shareExpiresAt,
    })
    .returning();
  return { view: toView(row!), ephemeralPubKey: publicKeyHex };
}

export async function getShareRequest(
  orgId: string,
  id: string,
): Promise<ShareRequestView | null> {
  const [row] = await db
    .select()
    .from(walletShareRequests)
    .where(
      and(
        eq(walletShareRequests.id, id),
        eq(walletShareRequests.organizationId, orgId),
      ),
    );
  return row ? toView(row) : null;
}

// Recent import requests for the clinic — feeds the Signing panel's "Signed
// records" / shared-records list.
export async function listShareRequests(
  orgId: string,
  limit = 20,
): Promise<ShareRequestView[]> {
  const rows = await db
    .select()
    .from(walletShareRequests)
    .where(eq(walletShareRequests.organizationId, orgId))
    .orderBy(walletShareRequests.createdAt)
    .limit(limit);
  return rows.map(toView);
}

// Apply a response relayed back from the patient's device. On approval we
// decrypt the sealed bundle with the request's ephemeral private key and verify
// the wallet's Ed25519 signature over it (provenance: it really came from that
// wallet number). Returns the resolved view, or null when the request is unknown
// / already resolved. Throws on a tampered/forged bundle.
export async function applyShareResponse(
  requestId: string,
  walletNumber: string,
  decision: "approved" | "denied",
  sealed?: string,
  signatureHex?: string,
): Promise<ShareRequestView | null> {
  const [row] = await db
    .select()
    .from(walletShareRequests)
    .where(eq(walletShareRequests.id, requestId));
  if (!row || row.status !== "pending") return null;
  if (row.walletNumber !== walletNumber.trim()) return null;

  if (decision === "denied") {
    const [updated] = await db
      .update(walletShareRequests)
      .set({ status: "denied", resolvedAt: new Date() })
      .where(eq(walletShareRequests.id, requestId))
      .returning();
    return updated ? toView(updated) : null;
  }

  if (!sealed || !signatureHex) {
    throw new HttpError(400, "Approval is missing the sealed record bundle.");
  }
  const plaintext = open(decryptSecret(row.ephemeralPrivEnc), sealed);
  const publicKey = decodeWalletNumber(walletNumber);
  if (!verifySignature(publicKey, signatureHex, plaintext)) {
    throw new HttpError(400, "Bundle signature did not match the wallet number.");
  }
  const bundle = JSON.parse(Buffer.from(plaintext).toString("utf8")) as {
    patient: Patient;
  };

  const [updated] = await db
    .update(walletShareRequests)
    .set({ status: "approved", resolvedAt: new Date(), draft: bundle.patient })
    .where(eq(walletShareRequests.id, requestId))
    .returning();
  return updated ? toView(updated) : null;
}

// Record the file number once a clinic commits the imported draft, so a later
// revoke from the device can delete exactly that record.
export async function markCommitted(
  orgId: string,
  id: string,
  fileNumber: string,
): Promise<void> {
  await db
    .update(walletShareRequests)
    .set({ committedFileNumber: fileNumber })
    .where(
      and(
        eq(walletShareRequests.id, id),
        eq(walletShareRequests.organizationId, orgId),
      ),
    );
}

// Patient-initiated revoke from the app: find the committed import for this
// request + wallet and hard-delete that patient from the clinic. Returns the
// org/fileNumber deleted (for an activity entry), or null.
export async function revokeShare(
  requestId: string,
  walletNumber: string,
): Promise<{ orgId: string; fileNumber: string } | null> {
  const [row] = await db
    .select()
    .from(walletShareRequests)
    .where(eq(walletShareRequests.id, requestId));
  if (!row || row.walletNumber !== walletNumber.trim()) return null;
  if (!row.committedFileNumber) return null;
  const ok = await deletePatient(row.organizationId, row.committedFileNumber);
  if (!ok) return null;
  await recordActivity({
    orgId: row.organizationId,
    actor: { id: row.requestedBy, name: "Patient wallet" },
    action: `Patient revoked shared record #${row.committedFileNumber}`,
    entityType: "patient",
    entityId: row.committedFileNumber,
    patientFileNumber: row.committedFileNumber,
  }).catch(() => {});
  return { orgId: row.organizationId, fileNumber: row.committedFileNumber };
}

// Deployment-wide sweep: hard-delete any temporarily-shared patient whose
// share window has passed. Called on an interval from index.ts.
export async function sweepExpiredShares(): Promise<number> {
  const expired = await db
    .select({
      organizationId: patients.organizationId,
      fileNumber: patients.fileNumber,
    })
    .from(patients)
    .where(
      and(
        isNotNull(patients.shareExpiresAt),
        lte(patients.shareExpiresAt, new Date()),
      ),
    );
  for (const p of expired) {
    await deletePatient(p.organizationId, p.fileNumber);
    await recordActivity({
      orgId: p.organizationId,
      actor: { id: "system", name: "temetro" },
      action: `Temporary shared record #${p.fileNumber} expired and was deleted`,
      entityType: "patient",
      entityId: p.fileNumber,
      patientFileNumber: p.fileNumber,
    }).catch(() => {});
  }
  return expired.length;
}

// Build the canonical bytes a wallet signs / the clinic verifies for a bundle.
export function bundleBytes(patient: Patient): Uint8Array {
  return utf8ToBytes(JSON.stringify({ patient }));
}
