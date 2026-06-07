"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthShell } from "@/components/auth/auth-ui";
import { CreateClinicForm } from "@/components/clinic/create-clinic-form";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Send unauthenticated users to login. Authenticated users (whether brand
  // new or creating an additional clinic) stay on this page.
  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/login");
  }, [session, isPending, router]);

  return (
    <AuthShell
      subtitle="Create your clinic to start organizing patient records"
      title="Set up your clinic"
    >
      <CreateClinicForm onCreated={() => router.push("/")} />
    </AuthShell>
  );
}
