"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (err) {
      setError(err.message ?? "Could not send the reset email.");
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      footer={
        <Link className="text-foreground hover:underline" href="/login">
          Back to sign in
        </Link>
      }
      subtitle="We'll email you a link to reset your password"
      title="Reset your password"
    >
      {sent ? (
        <FormAlert tone="success">
          If an account exists for {email}, a reset link is on its way. Check
          your inbox.
        </FormAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {error && <FormAlert>{error}</FormAlert>}
          <Field htmlFor="email" label="Email">
            <Input
              autoComplete="email"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.org"
              required
              type="email"
              value={email}
            />
          </Field>
          <Button className="mt-1 w-full" disabled={submitting} type="submit">
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
