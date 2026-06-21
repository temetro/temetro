import { hexToBytes } from "@noble/hashes/utils.js";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { clinicSigningKeys } from "../db/schema/signing.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import {
  fingerprint,
  newSigningKeypair,
  signMessage,
} from "../lib/wallet-crypto.js";

export type SigningKeyView = {
  algorithm: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
  rotatedAt: string | null;
};

type SigningKeyRow = typeof clinicSigningKeys.$inferSelect;

function toView(row: SigningKeyRow): SigningKeyView {
  return {
    algorithm: row.algorithm,
    publicKey: row.publicKey,
    fingerprint: row.fingerprint,
    createdAt: row.createdAt.toISOString(),
    rotatedAt: row.rotatedAt ? row.rotatedAt.toISOString() : null,
  };
}

// Generate a fresh Ed25519 keypair and upsert it as the clinic's signing key
// (rotating overwrites the row and stamps `rotatedAt`). The private key is only
// ever stored encrypted (lib/crypto.ts).
async function mintKey(orgId: string, rotating: boolean): Promise<SigningKeyView> {
  const { privateKeyHex, publicKeyHex } = newSigningKeypair();
  const fp = fingerprint(hexToBytes(publicKeyHex));
  const [row] = await db
    .insert(clinicSigningKeys)
    .values({
      organizationId: orgId,
      algorithm: "ed25519",
      publicKey: publicKeyHex,
      fingerprint: fp,
      privateKeyEnc: encryptSecret(privateKeyHex),
      rotatedAt: rotating ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: clinicSigningKeys.organizationId,
      set: {
        publicKey: publicKeyHex,
        fingerprint: fp,
        privateKeyEnc: encryptSecret(privateKeyHex),
        rotatedAt: new Date(),
      },
    })
    .returning();
  return toView(row!);
}

// The clinic's signing key, creating one on first read so the panel always has
// a real key + fingerprint to show.
export async function getOrCreateKey(orgId: string): Promise<SigningKeyView> {
  const [existing] = await db
    .select()
    .from(clinicSigningKeys)
    .where(eq(clinicSigningKeys.organizationId, orgId));
  if (existing) return toView(existing);
  return mintKey(orgId, false);
}

export async function rotateKey(orgId: string): Promise<SigningKeyView> {
  return mintKey(orgId, true);
}

// Sign a message with the clinic's signing key (creating one if needed). Returns
// the signature + public key so a verifier can check provenance.
export async function signWithClinicKey(
  orgId: string,
  message: Uint8Array,
): Promise<{ signature: string; publicKey: string }> {
  const [row] = await db
    .select()
    .from(clinicSigningKeys)
    .where(eq(clinicSigningKeys.organizationId, orgId));
  if (!row) {
    const view = await mintKey(orgId, false);
    const [fresh] = await db
      .select()
      .from(clinicSigningKeys)
      .where(eq(clinicSigningKeys.organizationId, orgId));
    return {
      signature: signMessage(decryptSecret(fresh!.privateKeyEnc), message),
      publicKey: view.publicKey,
    };
  }
  return {
    signature: signMessage(decryptSecret(row.privateKeyEnc), message),
    publicKey: row.publicKey,
  };
}
