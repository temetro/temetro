"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function AcceptInviteInner() {
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
      setError(err?.message ?? "This invitation is invalid or has expired.");
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
      <AuthShell title="Invitation not found">
        <FormAlert>This invitation link is missing or invalid.</FormAlert>
      </AuthShell>
    );
  }

  // Must be signed in (with the invited email) to accept.
  if (!isPending && !session?.user) {
    const back = `/accept-invite?id=${encodeURIComponent(invitationId)}`;
    return (
      <AuthShell
        subtitle="Sign in with the email this invitation was sent to, then return to this link to accept."
        title="You've been invited"
      >
        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => router.push("/login")}
            type="button"
          >
            Sign in
          </Button>
          <Button
            className="w-full"
            onClick={() => router.push("/signup")}
            type="button"
            variant="outline"
          >
            Create an account
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            After signing in, reopen{" "}
            <Link className="hover:underline" href={back}>
              this invitation link
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      subtitle="Join the clinic you were invited to on temetro."
      title="Accept your invitation"
    >
      <div className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          className="w-full"
          disabled={accepting}
          onClick={accept}
          type="button"
        >
          {accepting ? "Joining…" : "Accept invitation"}
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
