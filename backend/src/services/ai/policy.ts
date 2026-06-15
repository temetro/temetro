import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { orgAiPolicy } from "../../db/schema/org-ai-policy.js";

export type AiPolicy = {
  aiEnabled: boolean;
  disabledForEmployees: boolean;
};

const DEFAULT_POLICY: AiPolicy = {
  aiEnabled: true,
  disabledForEmployees: false,
};

// Read a clinic's AI policy, falling back to the permissive default when no row
// exists yet.
export async function getPolicy(orgId: string): Promise<AiPolicy> {
  const [row] = await db
    .select({
      aiEnabled: orgAiPolicy.aiEnabled,
      disabledForEmployees: orgAiPolicy.disabledForEmployees,
    })
    .from(orgAiPolicy)
    .where(eq(orgAiPolicy.organizationId, orgId))
    .limit(1);
  return row ?? DEFAULT_POLICY;
}

export async function savePolicy(
  orgId: string,
  policy: AiPolicy,
): Promise<AiPolicy> {
  await db
    .insert(orgAiPolicy)
    .values({ organizationId: orgId, ...policy })
    .onConflictDoUpdate({
      target: orgAiPolicy.organizationId,
      set: { ...policy, updatedAt: new Date() },
    });
  return policy;
}

// Whether a member with `role` may use the AI under `policy`. Owners/admins keep
// access when AI is only disabled for employees; a full disable blocks everyone.
export function aiAllowedFor(policy: AiPolicy, role: string | undefined): boolean {
  if (!policy.aiEnabled) return false;
  if (!policy.disabledForEmployees) return true;
  const names = String(role ?? "")
    .split(",")
    .map((s) => s.trim());
  return names.some((r) => r === "owner" || r === "admin");
}
