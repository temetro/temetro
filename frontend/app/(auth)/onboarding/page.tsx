"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AuthShell } from "@/components/auth/auth-ui";
import { CreateClinicForm } from "@/components/clinic/create-clinic-form";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const { t } = useTranslation();
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
      subtitle={t("auth.onboarding.subtitle")}
      title={t("auth.onboarding.title")}
    >
      <CreateClinicForm onCreated={() => router.push("/")} />
    </AuthShell>
  );
}
