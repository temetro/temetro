"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { authClient } from "@/lib/auth-client";

// Authoritative client-side gate for the app shell: requires a session and an
// active clinic, otherwise redirects to login / onboarding. The API enforces
// the same rules server-side.
export function AppAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  const ready = Boolean(data?.user && data.session?.activeOrganizationId);

  useEffect(() => {
    if (isPending) return;
    if (!data?.user) {
      router.replace("/login");
    } else if (!data.session?.activeOrganizationId) {
      router.replace("/onboarding");
    }
  }, [data, isPending, router]);

  if (!ready) {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
