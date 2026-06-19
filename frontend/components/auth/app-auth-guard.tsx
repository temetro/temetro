"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { useAiAccess } from "@/lib/ai-policy";
import { authClient } from "@/lib/auth-client";
import { canAccessRoute, defaultLandingFor, useActiveRole } from "@/lib/roles";

// Authoritative client-side gate for the app shell. Requires a session and an
// active clinic. If the user is signed in without an active clinic but already
// belongs to one, we select it automatically; onboarding is only for users
// with no clinics at all. The API enforces the same access rules server-side.
export function AppAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useActiveRole();
  const { allowed: aiAllowed, loading: aiLoading } = useAiAccess();
  const { data: session, isPending } = authClient.useSession();
  const { data: orgs, isPending: orgsPending } =
    authClient.useListOrganizations();
  const settingActive = useRef(false);

  const hasUser = Boolean(session?.user);
  const activeOrgId = session?.session?.activeOrganizationId ?? null;

  useEffect(() => {
    if (isPending) return;
    if (!hasUser) {
      router.replace("/login");
      return;
    }
    if (activeOrgId) return;

    // Signed in but no active clinic selected yet.
    if (orgsPending) return;
    // A setActive is already in flight (e.g. just after creating a clinic) — wait
    // for it rather than treating the momentarily-empty list as "no clinics" and
    // bouncing the user back to onboarding.
    if (settingActive.current) return;
    const first = orgs?.[0];
    if (first) {
      settingActive.current = true;
      void authClient.organization
        .setActive({ organizationId: first.id })
        // Refresh the cached session so activeOrganizationId is populated and the
        // guard re-renders into the ready state.
        .then(() =>
          authClient.getSession({ query: { disableCookieCache: true } }),
        )
        .catch(() => {
          settingActive.current = false;
        });
    } else {
      router.replace("/onboarding");
    }
  }, [isPending, hasUser, activeOrgId, orgsPending, orgs, router]);

  const ready = hasUser && Boolean(activeOrgId);

  // Role-based route guard: keep non-clinical roles (reception) out of clinical
  // pages — bounce them to their default landing. The backend enforces the same
  // via per-route RBAC (403); this just avoids showing an empty/erroring page.
  useEffect(() => {
    if (!ready || role == null) return;
    if (!canAccessRoute(pathname, role)) {
      router.replace(defaultLandingFor(role));
      return;
    }
    // AI kill-switch: the AI surfaces — chat home ("/") and Analysis — are off
    // for this user (a full clinic disable also covers owners/admins). Send them
    // to patients (clinical roles always have it; non-clinical never land here).
    if (
      !aiLoading &&
      !aiAllowed &&
      (pathname === "/" || pathname === "/analysis")
    ) {
      router.replace("/patients");
    }
  }, [ready, role, pathname, router, aiAllowed, aiLoading]);

  if (!ready) {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
