"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 12;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: `${window.location.origin}/verify-email`,
    });

    if (err) {
      setError(err.message ?? "Could not create your account.");
      setSubmitting(false);
      return;
    }
    // Email verification isn't enforced yet (see backend auth config), so the
    // user is signed in on sign-up — go straight to clinic onboarding. A
    // verification email is still sent for when verification is re-enabled.
    router.push("/");
  };

  return (
    <AuthShell
      footer={
        <>
          Already have an account?{" "}
          <Link className="text-foreground hover:underline" href="/login">
            Sign in
          </Link>
        </>
      }
      subtitle="Start using temetro in your clinic"
      title="Create your account"
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error && <FormAlert>{error}</FormAlert>}
        <Field htmlFor="name" label="Full name">
          <Input
            autoComplete="name"
            id="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jane Okafor"
            required
            value={name}
          />
        </Field>
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
        <Field
          hint={`At least ${MIN_PASSWORD} characters.`}
          htmlFor="password"
          label="Password"
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
        <Field htmlFor="confirm" label="Confirm password">
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
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
