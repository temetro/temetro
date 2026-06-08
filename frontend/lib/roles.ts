"use client";

import { useEffect, useState } from "react";

import { type roles } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { type NavItem, navItems } from "@/lib/nav";

export type RoleKey = keyof typeof roles;

// Roles an admin can assign when provisioning staff (owner is excluded — the
// clinic creator is the sole owner). Mirrors the backend's PROVISIONABLE_ROLES.
export const PROVISIONABLE_ROLES: RoleKey[] = [
  "admin",
  "doctor",
  "reception",
  "viewer",
];

// Departments a task can be assigned to (member roles). Mirrors the backend's
// TASK_DEPARTMENTS in lib/task-validation.ts.
export const DEPARTMENTS = ["admin", "doctor", "reception"] as const;

// The current user's role in the active clinic (null while loading or if they
// aren't a member). Re-fetches when the active organization changes.
export function useActiveRole(): string | null {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authClient.organization
      .getActiveMember()
      .then(({ data }) => {
        if (!cancelled) setRole(data?.role ?? null);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrg?.id]);

  return role;
}

// Whether a role may see clinical records (AI lookup, prescriptions, notes,
// analysis). Driven by Better Auth permissions so it stays in lock-step with
// lib/access.ts: the `reception` role has no `prescription` statement, so this
// is false for them and true for every clinical role.
export function hasClinicalAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  try {
    return authClient.organization.checkRolePermission({
      role: role as RoleKey,
      permissions: { prescription: ["read"] },
    });
  } catch {
    return false;
  }
}

// Where a role lands after sign-in. Reception has no AI chat, so they start on
// the appointments board; clinical roles start on the chat home.
export function defaultLandingFor(role: string | null | undefined): string {
  return hasClinicalAccess(role) ? "/" : "/appointments";
}

// Clinical-only routes — a non-clinical role (reception) is redirected away.
// Keyed by path; "/" matches exactly, others match themselves + nested paths.
const CLINICAL_ROUTES = [
  "/",
  "/prescriptions",
  "/analysis",
  "/notes",
  "/activity",
];

// Whether `path` is reachable by `role`. Returns true while the role is still
// loading to avoid redirect flicker; the authoritative check is the backend's
// per-route RBAC (which returns 403 regardless).
export function canAccessRoute(
  path: string,
  role: string | null | undefined,
): boolean {
  if (role == null) return true;
  if (hasClinicalAccess(role)) return true;
  return !CLINICAL_ROUTES.some((r) =>
    r === "/" ? path === "/" : path === r || path.startsWith(`${r}/`),
  );
}

// Nav items visible to a role, with clinical-only items (and sub-items) removed
// for non-clinical roles. While the role is loading we optimistically show
// everything (clinical users are the common case) — the flash is sub-second.
export function visibleNavItems(role: string | null | undefined): NavItem[] {
  if (role == null) return navItems;
  const clinical = hasClinicalAccess(role);
  return navItems
    .filter((item) => !item.requiresClinical || clinical)
    .map((item) => ({
      ...item,
      subs: item.subs?.filter((sub) => !sub.requiresClinical || clinical),
    }));
}
