import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "../../db/index.js";
import { fhirApiKeys } from "../../db/schema/fhir-keys.js";

// FHIR-server API keys. The secret is `tmf_` + 32 random bytes (base64url); we
// persist only its SHA-256 hash, so a leaked database never yields usable keys
// and the plaintext is returned exactly once (at creation).

const PREFIX = "tmf_";

export type FhirKeyView = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

function hashKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toView(row: typeof fhirApiKeys.$inferSelect): FhirKeyView {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revoked: row.revokedAt !== null,
  };
}

// List a clinic's keys (active first, then revoked), newest first. Never
// exposes the hash.
export async function listKeys(orgId: string): Promise<FhirKeyView[]> {
  const rows = await db
    .select()
    .from(fhirApiKeys)
    .where(eq(fhirApiKeys.organizationId, orgId))
    .orderBy(desc(fhirApiKeys.createdAt));
  return rows.map(toView);
}

// Mint a new key. Returns the one-time plaintext secret alongside the stored
// view — the caller must surface the secret to the user immediately; it is not
// recoverable afterwards.
export async function createKey(
  orgId: string,
  name: string,
  createdBy: string,
): Promise<{ secret: string; key: FhirKeyView }> {
  const secret = PREFIX + randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(fhirApiKeys)
    .values({
      organizationId: orgId,
      name: name.trim() || "FHIR key",
      keyHash: hashKey(secret),
      createdBy,
    })
    .returning();
  return { secret, key: toView(row!) };
}

// Revoke a key (idempotent). Scoped to the org so one clinic can't revoke
// another's. Returns false if no such active key exists.
export async function revokeKey(orgId: string, id: string): Promise<boolean> {
  const result = await db
    .update(fhirApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(fhirApiKeys.id, id),
        eq(fhirApiKeys.organizationId, orgId),
        isNull(fhirApiKeys.revokedAt),
      ),
    )
    .returning({ id: fhirApiKeys.id });
  return result.length > 0;
}

export type ResolvedKey = { orgId: string; keyId: string; keyName: string };

// Resolve a presented bearer secret to its owning organization (plus the key's
// identity, for the audit log), or null when it is unknown or revoked. Bumps
// `lastUsedAt` (throttled to once a minute) so the key list can show recent
// activity without a write on every request.
export async function resolveKey(secret: string): Promise<ResolvedKey | null> {
  if (!secret.startsWith(PREFIX)) return null;
  const [row] = await db
    .select()
    .from(fhirApiKeys)
    .where(eq(fhirApiKeys.keyHash, hashKey(secret)))
    .limit(1);
  if (!row || row.revokedAt) return null;

  const now = Date.now();
  const last = row.lastUsedAt?.getTime() ?? 0;
  if (now - last > 60_000) {
    void db
      .update(fhirApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(fhirApiKeys.id, row.id))
      .catch(() => {});
  }
  return { orgId: row.organizationId, keyId: row.id, keyName: row.name };
}
