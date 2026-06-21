// Client for the clinic signing key (Settings → Signing) and the "import from a
// patient app" wallet-share flow. Both call the backend over the shared fetch
// wrapper (session cookie sent automatically).

import { apiFetch } from "@/lib/api-client";

export type SigningKey = {
  algorithm: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string; // ISO
  rotatedAt: string | null;
};

export type WalletShareMode = "permanent" | "temporary";

export type SharedRecord = {
  id: string;
  walletNumber: string;
  status: "pending" | "approved" | "denied" | "expired";
  shareMode: WalletShareMode;
  shareExpiresAt: string | null;
  // The draft is only returned by the request-share poll, not the list.
};

// The clinic's Ed25519 signing key. The backend creates one lazily on first
// read, so this always resolves to a real key + fingerprint.
export async function getSigningKey(): Promise<SigningKey> {
  return apiFetch<SigningKey>("/api/signing/key");
}

// Rotate the signing key (owner/admin only). Returns the new key.
export async function rotateSigningKey(): Promise<SigningKey> {
  return apiFetch<SigningKey>("/api/signing/key/rotate", { method: "POST" });
}

// Recent records shared from patient wallets — feeds the panel's list.
export async function listSignedRecords(): Promise<SharedRecord[]> {
  return apiFetch<SharedRecord[]>("/api/signing/records");
}
