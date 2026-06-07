"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";

const MIN_PASSWORD = 12;

function ResetPasswordInner() {
  const { t } = useTranslation();
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
      setError(t("auth.resetPassword.invalidToken"));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t("auth.resetPassword.tooShort", { count: MIN_PASSWORD }));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.resetPassword.mismatch"));
      return;
    }

    setSubmitting(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setSubmitting(false);
    if (err) {
      const message = err.message ?? t("auth.resetPassword.error");
      setError(message);
      notify.error(t("auth.resetPassword.failedToastTitle"), message);
      return;
    }
    notify.success(
      t("auth.resetPassword.successToastTitle"),
      t("auth.resetPassword.successToastBody"),
    );
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  };

  return (
    <AuthShell
      footer={
        <Link className="text-foreground hover:underline" href="/login">
          {t("common.backToSignIn")}
        </Link>
      }
      subtitle={t("auth.resetPassword.subtitle")}
      title={t("auth.resetPassword.title")}
    >
      {done ? (
        <FormAlert tone="success">{t("auth.resetPassword.done")}</FormAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {error && <FormAlert>{error}</FormAlert>}
          <Field
            hint={t("auth.resetPassword.passwordHint", { count: MIN_PASSWORD })}
            htmlFor="password"
            label={t("auth.resetPassword.passwordLabel")}
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
          <Field
            htmlFor="confirm"
            label={t("auth.resetPassword.confirmLabel")}
          >
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
            {submitting
              ? t("auth.resetPassword.submitting")
              : t("auth.resetPassword.submit")}
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
