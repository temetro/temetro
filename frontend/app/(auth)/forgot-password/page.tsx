"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthShell, Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { requestResetByUsername } from "@/lib/auth-helpers";
import { notify } from "@/lib/toast";

type Mode = "email" | "username";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  // Owners reset by the email they signed up with; admin-provisioned staff reset
  // by their username (their email may be a synthetic placeholder).
  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const redirectTo = `${window.location.origin}/reset-password`;

    if (mode === "email") {
      const { error: err } = await authClient.requestPasswordReset({
        email: identifier.trim(),
        redirectTo,
      });
      setSubmitting(false);
      if (err) {
        const message = err.message ?? t("auth.forgotPassword.error");
        setError(message);
        notify.error(t("auth.forgotPassword.failedToastTitle"), message);
        return;
      }
    } else {
      try {
        await requestResetByUsername(identifier.trim(), redirectTo);
      } catch {
        setSubmitting(false);
        const message = t("auth.forgotPassword.error");
        setError(message);
        notify.error(t("auth.forgotPassword.failedToastTitle"), message);
        return;
      }
      setSubmitting(false);
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
          {mode === "email"
            ? t("auth.forgotPassword.sent", { email: identifier })
            : t("auth.forgotPassword.sentUsername")}
        </FormAlert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {error && <FormAlert>{error}</FormAlert>}
          <Tabs
            onValueChange={(value) => {
              setMode(value as Mode);
              setError(null);
              setIdentifier("");
            }}
            value={mode}
          >
            <TabsList className="w-full">
              <TabsTab className="flex-1" value="email">
                {t("auth.forgotPassword.modeEmail")}
              </TabsTab>
              <TabsTab className="flex-1" value="username">
                {t("auth.forgotPassword.modeUsername")}
              </TabsTab>
            </TabsList>
          </Tabs>
          <Field
            htmlFor="identifier"
            label={
              mode === "email"
                ? t("auth.forgotPassword.emailLabel")
                : t("auth.forgotPassword.usernameLabel")
            }
          >
            <Input
              autoComplete={mode === "email" ? "email" : "username"}
              id="identifier"
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                mode === "email"
                  ? t("auth.forgotPassword.emailPlaceholder")
                  : t("auth.forgotPassword.usernamePlaceholder")
              }
              required
              type={mode === "email" ? "email" : "text"}
              value={identifier}
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
