"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

const MIN_PASSWORD = 12;

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setSubmitting(false);
    if (err) {
      const message = err.message ?? "Could not reset your password.";
      setError(message);
      notify.error("Couldn't reset password", message);
      return;
    }
    notify.success("Password updated", "Redirecting you to sign in…");
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <AuthShell
      footer={
        <Link className="text-foreground hover:underline" href="/login">
          Back to sign in
        </Link>
      }
      subtitle="Choose a new password for your account"
      title="Set a new password"
    >
      {done ? (
        <FormAlert tone="success">
          Your password has been reset. Redirecting you to sign in…
        </FormAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {error && <FormAlert>{error}</FormAlert>}
          <Field
            hint={`At least ${MIN_PASSWORD} characters.`}
            htmlFor="password"
            label="New password"
          >
            <Input
              autoComplete="new-password"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              type="password"
              value={password}
            />
          </Field>
          <Field htmlFor="confirm" label="Confirm new password">
            <Input
              autoComplete="new-password"
              id="confirm"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••••••"
              required
              type="password"
              value={confirm}
            />
          </Field>
          <Button className="mt-1 w-full" disabled={submitting} type="submit">
            {submitting ? "Saving…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}
