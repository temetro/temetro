"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthShell, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { data: session } = authClient.useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // After the emailed link verifies the address, Better Auth auto-signs the
  // user in and redirects here — at which point a session exists.
  useEffect(() => {
    if (session?.user) router.replace("/");
  }, [session, router]);

  const resend = async () => {
    if (!email || sending) return;
    setSending(true);
    setError(null);
    setNotice(null);
    const { error: err } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/verify-email`,
    });
    setSending(false);
    if (err) {
      setError(err.message ?? "Could not resend the verification email.");
      return;
    }
    setNotice("Verification email sent. Check your inbox.");
  };

  return (
    <AuthShell
      footer={
        <Link className="text-foreground hover:underline" href="/login">
          Back to sign in
        </Link>
      }
      subtitle={
        email ? (
          <>
            We sent a verification link to{" "}
            <span className="text-foreground">{email}</span>. Open it to activate
            your account.
          </>
        ) : (
          "Open the verification link we emailed you to activate your account."
        )
      }
      title="Check your inbox"
    >
      <div className="flex flex-col gap-4">
        {notice && <FormAlert tone="success">{notice}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          className="w-full"
          onClick={() => router.push("/")}
          type="button"
        >
          I&apos;ve verified — continue
        </Button>
        {email && (
          <Button
            className="w-full"
            disabled={sending}
            onClick={resend}
            type="button"
            variant="outline"
          >
            {sending ? "Sending…" : "Resend email"}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
