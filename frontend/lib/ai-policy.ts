"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { useActiveRole } from "@/lib/roles";

// Mirrors backend/src/services/ai/policy.ts. Clinic-wide AI availability, set by
// owners/admins. Absent/default = AI enabled for everyone.
export type AiPolicy = {
  aiEnabled: boolean;
  disabledForEmployees: boolean;
};

export function getAiPolicy(): Promise<AiPolicy> {
  return apiFetch<AiPolicy>("/api/ai/policy");
}

export function saveAiPolicy(policy: AiPolicy): Promise<AiPolicy> {
  return apiFetch<AiPolicy>("/api/ai/policy", {
    method: "PUT",
    body: JSON.stringify(policy),
  });
}

function isAdminRole(role: string | null): boolean {
  return String(role ?? "")
    .split(",")
    .map((s) => s.trim())
    .some((r) => r === "owner" || r === "admin");
}

// Whether a member with `role` may use the AI under `policy`. Owners/admins keep
// access when AI is only disabled for employees.
export function aiAllowedFor(
  policy: AiPolicy | null,
  role: string | null,
): boolean {
  if (!policy) return true; // optimistic while loading — avoids nav flicker
  if (!policy.aiEnabled) return false;
  if (!policy.disabledForEmployees) return true;
  return isAdminRole(role);
}

// Whether the current user may use the AI (clinic policy + their role). Returns
// `allowed: true` while loading so the AI nav doesn't flash out then back in.
export function useAiAccess(): { allowed: boolean; loading: boolean } {
  const role = useActiveRole();
  const [policy, setPolicy] = useState<AiPolicy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAiPolicy()
      .then((p) => {
        if (active) setPolicy(p);
      })
      .catch(() => {
        /* leave permissive default; backend still enforces */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { allowed: aiAllowedFor(policy, role), loading };
}
