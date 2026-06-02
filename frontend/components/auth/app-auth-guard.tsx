"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";

// Authoritative client-side gate for the app shell. Requires a session and an
// active clinic. If the user is signed in without an active clinic but already
// belongs to one, we select it automatically; onboarding is only for users
// with no clinics at all. The API enforces the same access rules server-side.
export function AppAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
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
    const first = orgs?.[0];
    if (first) {
      if (!settingActive.current) {
        settingActive.current = true;
        void authClient.organization.setActive({ organizationId: first.id });
      }
    } else {
      router.replace("/onboarding");
    }
  }, [isPending, hasUser, activeOrgId, orgsPending, orgs, router]);

  const ready = hasUser && Boolean(activeOrgId);
  if (!ready) {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
