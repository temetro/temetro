"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
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
      const message = err.message ?? t("auth.forgotPassword.error");
      setError(message);
      notify.error(t("auth.forgotPassword.failedToastTitle"), message);
      return;
    }
    notify.success(
      t("auth.forgotPassword.sentToastTitle"),
      t("auth.forgotPassword.sentToastBody"),
    );
    setSent(true);
  };

  return (
    <AuthShell
      footer={
        <Link className="text-foreground hover:underline" href="/login">
          {t("common.backToSignIn")}
        </Link>
      }
      subtitle={t("auth.forgotPassword.subtitle")}
      title={t("auth.forgotPassword.title")}
    >
      {sent ? (
        <FormAlert tone="success">
          {t("auth.forgotPassword.sent", { email })}
        </FormAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {error && <FormAlert>{error}</FormAlert>}
          <Field htmlFor="email" label={t("auth.forgotPassword.emailLabel")}>
            <Input
              autoComplete="email"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.forgotPassword.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </Field>
          <Button className="mt-1 w-full" disabled={submitting} type="submit">
            {submitting
              ? t("auth.forgotPassword.submitting")
              : t("auth.forgotPassword.submit")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
