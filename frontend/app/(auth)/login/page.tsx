"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await authClient.signIn.email({
      email: email.trim(),
      password,
      callbackURL: `${window.location.origin}/`,
    });

    if (err) {
      setError(
        err.message ??
          "Could not sign in. Check your email and password and try again."
      );
      setSubmitting(false);
      return;
    }
    router.push("/");
  };

  return (
    <AuthShell
      footer={
        <>
          New to temetro?{" "}
          <Link className="text-foreground hover:underline" href="/signup">
            Create an account
          </Link>
        </>
      }
      subtitle="Sign in to your clinician account"
      title="Welcome back"
    >
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
        <Field htmlFor="password" label="Password">
          <Input
            autoComplete="current-password"
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            type="password"
            value={password}
          />
        </Field>
        <div className="-mt-1 text-right">
          <Link
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <Button className="mt-1 w-full" disabled={submitting} type="submit">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
