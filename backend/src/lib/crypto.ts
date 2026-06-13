import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { env } from "../env.js";

// Symmetric encryption for at-rest secrets (currently the per-user AI provider
// API keys). AES-256-GCM with a random 12-byte IV per message; the key is
// derived from AI_CREDENTIALS_KEY so rotating the env var invalidates old
// ciphertexts (by design — keys then need re-entering). The stored format is
// `v1:<iv>:<authTag>:<ciphertext>`, all base64.

const FORMAT = "v1";

// 32-byte key from the configured secret (sha-256 lets the operator use any
// length passphrase while we always feed AES-256 a 256-bit key).
function key(): Buffer {
  return createHash("sha256").update(env.AI_CREDENTIALS_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [format, ivB64, tagB64, dataB64] = payload.split(":");
  if (format !== FORMAT || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized secret format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return (
    decipher.update(Buffer.from(dataB64, "base64")).toString("utf8") +
    decipher.final("utf8")
  );
}
