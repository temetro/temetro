"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 12;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation();
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
      setError(t("auth.signup.passwordTooShort", { count: MIN_PASSWORD }));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.signup.passwordMismatch"));
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
      setError(err.message ?? t("auth.signup.error"));
      setSubmitting(false);
      return;
    }
    // Verification isn't enforced yet — the user is signed in, so go to
    // clinic onboarding.
    router.push("/");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("auth.signup.title")}</CardTitle>
          <CardDescription>{t("auth.signup.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Field>
                <FieldLabel htmlFor="name">
                  {t("auth.signup.nameLabel")}
                </FieldLabel>
                <Input
                  autoComplete="name"
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.signup.namePlaceholder")}
                  required
                  type="text"
                  value={name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">
                  {t("auth.signup.emailLabel")}
                </FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.signup.emailPlaceholder")}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field className="w-full">
                <Field className="grid w-full grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">
                      {t("auth.signup.passwordLabel")}
                    </FieldLabel>
                    <Input
                      autoComplete="new-password"
                      id="password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      type="password"
                      value={password}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      {t("auth.signup.confirmPasswordLabel")}
                    </FieldLabel>
                    <Input
                      autoComplete="new-password"
                      id="confirm-password"
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      type="password"
                      value={confirm}
                    />
                  </Field>
                </Field>
                <FieldDescription>
                  {t("auth.signup.passwordHint", { count: MIN_PASSWORD })}
                </FieldDescription>
              </Field>
              <Field className="w-full">
                <Button className="w-full" disabled={submitting} type="submit">
                  {submitting
                    ? t("auth.signup.submitting")
                    : t("auth.signup.submit")}
                </Button>
                <FieldDescription className="w-full text-center">
                  {t("auth.signup.haveAccount")}{" "}
                  <Link
                    className="font-medium text-foreground underline underline-offset-4"
                    href="/login"
                  >
                    {t("auth.signup.signInLink")}
                  </Link>
                </FieldDescription>
              </Field>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
