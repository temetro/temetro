"use client";

import { useEffect, useState } from "react";

import { type roles } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { type AccessArea, type NavItem, navItems } from "@/lib/nav";

export type RoleKey = keyof typeof roles;

// Roles an admin can assign when provisioning staff (owner is excluded — the
// clinic creator is the sole owner). Mirrors the backend's PROVISIONABLE_ROLES.
export const PROVISIONABLE_ROLES: RoleKey[] = [
  "admin",
  "doctor",
  "reception",
  "pharmacy",
  "lab",
];

// Departments a task can be assigned to (member roles). Mirrors the backend's
// TASK_DEPARTMENTS in lib/task-validation.ts.
export const DEPARTMENTS = [
  "admin",
  "doctor",
  "reception",
  "pharmacy",
  "lab",
] as const;

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

// The clinical resources + actions we surface in the Care Team permissions
// summary. Mirrors the statements in lib/access.ts.
export const CLINICAL_RESOURCES = [
  "patient",
  "appointment",
  "prescription",
  "task",
  "lab",
] as const;
const RESOURCE_ACTIONS = ["read", "write", "delete"] as const;

type PermissionArg = Parameters<
  typeof authClient.organization.checkRolePermission
>[0]["permissions"];

// For a given role, the allowed actions on each clinical resource — computed
// from Better Auth so it stays in lock-step with lib/access.ts. Used by the
// Care Team employee dialog to show what a role can do.
export function rolePermissionSummary(
  role: string | null | undefined,
): { resource: (typeof CLINICAL_RESOURCES)[number]; actions: string[] }[] {
  if (!role) return [];
  return CLINICAL_RESOURCES.map((resource) => {
    const actions = RESOURCE_ACTIONS.filter((action) => {
      try {
        return authClient.organization.checkRolePermission({
          role: role as RoleKey,
          permissions: { [resource]: [action] } as PermissionArg,
        });
      } catch {
        return false;
      }
    });
    return { resource, actions };
  });
}

// Permission probes per access area, all derived from lib/access.ts so route
// gating can never drift from RBAC:
// - clinical: `prescription:delete` is held ONLY by full clinicians
//   (owner/admin/doctor/member) — pharmacy has read/write but not delete,
//   reception/lab no prescription statement at all.
// - pharmacy: `prescription:write` (pharmacy + full clinicians).
// - lab: `lab:write` (lab + full clinicians).
const AREA_PROBES: Record<AccessArea, PermissionArg> = {
  clinical: { prescription: ["delete"] } as PermissionArg,
  pharmacy: { prescription: ["write"] } as PermissionArg,
  lab: { lab: ["write"] } as PermissionArg,
};

// Whether a role belongs to an access area (see AccessArea in lib/nav.ts).
export function canAccessArea(
  role: string | null | undefined,
  area: AccessArea,
): boolean {
  if (!role) return false;
  try {
    return authClient.organization.checkRolePermission({
      role: role as RoleKey,
      permissions: AREA_PROBES[area],
    });
  } catch {
    return false;
  }
}

// Whether a role may see clinical records (AI lookup, prescriptions, notes,
// analysis) — true for full clinicians (owner/admin/doctor/member) only.
export function hasClinicalAccess(role: string | null | undefined): boolean {
  return canAccessArea(role, "clinical");
}

// Where a role lands after sign-in: clinicians on the chat home, pharmacy/lab
// on their department dashboards, reception on the appointments board.
export function defaultLandingFor(role: string | null | undefined): string {
  if (canAccessArea(role, "clinical")) return "/";
  if (canAccessArea(role, "pharmacy")) return "/pharmacy";
  if (canAccessArea(role, "lab")) return "/lab";
  return "/appointments";
}

// Area-gated routes — a role outside the area is redirected away. Keyed by
// path; "/" matches exactly, others match themselves + nested paths.
const ROUTE_AREAS: Record<string, AccessArea> = {
  "/": "clinical",
  "/prescriptions": "clinical",
  "/analysis": "clinical",
  "/notes": "clinical",
  "/activity": "clinical",
  "/pharmacy": "pharmacy",
  "/inventory": "pharmacy",
  "/lab": "lab",
};

// Whether `path` is reachable by `role`. Returns true while the role is still
// loading to avoid redirect flicker; the authoritative check is the backend's
// per-route RBAC (which returns 403 regardless).
export function canAccessRoute(
  path: string,
  role: string | null | undefined,
): boolean {
  if (role == null) return true;
  const match = Object.entries(ROUTE_AREAS).find(([route]) =>
    route === "/" ? path === "/" : path === route || path.startsWith(`${route}/`),
  );
  if (!match) return true;
  return canAccessArea(role, match[1]);
}

// Nav items visible to a role, with area-gated items (and sub-items) removed
// for roles outside the area. While the role is loading we optimistically show
// everything (clinical users are the common case) — the flash is sub-second.
// Full clinicians pass every area probe, so they also see the Pharmacy and Lab
// items (intentional oversight access).
export function visibleNavItems(role: string | null | undefined): NavItem[] {
  if (role == null) return navItems;
  return navItems
    .filter((item) => !item.access || canAccessArea(role, item.access))
    .map((item) => ({
      ...item,
      subs: item.subs?.filter(
        (sub) => !sub.access || canAccessArea(role, sub.access),
      ),
    }));
}
