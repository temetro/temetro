import { and, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { integrations } from "../../db/schema/integrations.js";
import { decryptSecret, encryptSecret } from "../../lib/crypto.js";

export const INTEGRATION_TYPES = ["fhir", "eprescribe", "claims"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export type IntegrationStatus = "unconfigured" | "connected" | "error";

// Public view sent to the client — never includes the decrypted credentials,
// only whether they are set.
export type IntegrationConfig = {
  type: IntegrationType;
  endpoint: string;
  enabled: boolean;
  status: IntegrationStatus;
  hasCredentials: boolean;
  lastSyncAt: string | null;
};

type Row = typeof integrations.$inferSelect;

function toConfig(type: IntegrationType, row: Row | undefined): IntegrationConfig {
  return {
    type,
    endpoint: row?.endpoint ?? "",
    enabled: row?.enabled ?? false,
    status: (row?.status as IntegrationStatus) ?? "unconfigured",
    hasCredentials: Boolean(row?.credentials),
    lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
  };
}

export async function listConfigs(orgId: string): Promise<IntegrationConfig[]> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.organizationId, orgId));
  const byType = new Map(rows.map((r) => [r.type, r]));
  return INTEGRATION_TYPES.map((type) => toConfig(type, byType.get(type)));
}

export async function getConfig(
  orgId: string,
  type: IntegrationType,
): Promise<IntegrationConfig> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type),
      ),
    )
    .limit(1);
  return toConfig(type, row);
}

// Internal: the decrypted credentials string (a JSON blob the caller parses),
// or null when none are stored.
export async function getCredentials(
  orgId: string,
  type: IntegrationType,
): Promise<string | null> {
  const [row] = await db
    .select({ credentials: integrations.credentials })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type),
      ),
    )
    .limit(1);
  if (!row?.credentials) return null;
  try {
    return decryptSecret(row.credentials);
  } catch {
    return null;
  }
}

// Internal: the configured endpoint, or "" when unset.
export async function getEndpoint(
  orgId: string,
  type: IntegrationType,
): Promise<string> {
  return (await getConfig(orgId, type)).endpoint;
}

export async function saveConfig(
  orgId: string,
  type: IntegrationType,
  input: { endpoint?: string; enabled?: boolean; credentials?: string },
): Promise<IntegrationConfig> {
  const set: Partial<Row> = { updatedAt: new Date() };
  if (input.endpoint !== undefined) set.endpoint = input.endpoint.trim();
  if (input.enabled !== undefined) set.enabled = input.enabled;
  // A non-empty credentials string replaces the stored secret; an empty string
  // clears it; undefined leaves it untouched.
  if (input.credentials !== undefined) {
    set.credentials = input.credentials
      ? encryptSecret(input.credentials)
      : null;
  }

  await db
    .insert(integrations)
    .values({
      organizationId: orgId,
      type,
      endpoint: set.endpoint ?? "",
      enabled: set.enabled ?? false,
      credentials: set.credentials ?? null,
    })
    .onConflictDoUpdate({
      target: [integrations.organizationId, integrations.type],
      set,
    });

  return getConfig(orgId, type);
}

export async function markStatus(
  orgId: string,
  type: IntegrationType,
  status: IntegrationStatus,
  touchSync = false,
): Promise<void> {
  await db
    .update(integrations)
    .set({
      status,
      ...(touchSync ? { lastSyncAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrations.organizationId, orgId),
        eq(integrations.type, type),
      ),
    );
}
