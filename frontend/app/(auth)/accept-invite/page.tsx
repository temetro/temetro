"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthShell, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function AcceptInviteInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const invitationId = params.get("id") ?? "";
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    if (!invitationId || accepting) return;
    setAccepting(true);
    setError(null);
    const { data, error: err } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (err || !data) {
      setError(err?.message ?? t("auth.acceptInvite.error"));
      setAccepting(false);
      return;
    }
    const orgId = data.invitation?.organizationId;
    if (orgId) {
      await authClient.organization.setActive({ organizationId: orgId });
    }
    router.push("/");
  };

  if (!invitationId) {
    return (
      <AuthShell title={t("auth.acceptInvite.notFoundTitle")}>
        <FormAlert>{t("auth.acceptInvite.notFoundBody")}</FormAlert>
      </AuthShell>
    );
  }

  // Must be signed in (with the invited email) to accept.
  if (!isPending && !session?.user) {
    const back = `/accept-invite?id=${encodeURIComponent(invitationId)}`;
    return (
      <AuthShell
        subtitle={t("auth.acceptInvite.invitedSubtitle")}
        title={t("auth.acceptInvite.invitedTitle")}
      >
        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => router.push("/login")}
            type="button"
          >
            {t("auth.acceptInvite.signIn")}
          </Button>
          <Button
            className="w-full"
            onClick={() => router.push("/signup")}
            type="button"
            variant="outline"
          >
            {t("auth.acceptInvite.createAccount")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t("auth.acceptInvite.reopenPrefix")}{" "}
            <Link className="hover:underline" href={back}>
              {t("auth.acceptInvite.reopenLink")}
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      subtitle={t("auth.acceptInvite.acceptSubtitle")}
      title={t("auth.acceptInvite.acceptTitle")}
    >
      <div className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          className="w-full"
          disabled={accepting}
          onClick={accept}
          type="button"
        >
          {accepting
            ? t("auth.acceptInvite.accepting")
            : t("auth.acceptInvite.accept")}
        </Button>
      </div>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteInner />
    </Suspense>
  );
}
