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
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation();
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
      const message = err.message ?? t("auth.login.error");
      setError(message);
      notify.error(t("auth.login.errorTitle"), message);
      setSubmitting(false);
      return;
    }
    notify.success(t("auth.login.welcomeBack"));
    router.push("/");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.subtitle")}</CardDescription>
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
                <FieldLabel htmlFor="email">
                  {t("auth.login.emailLabel")}
                </FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.login.emailPlaceholder")}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field className="w-full">
                <div className="flex w-full items-center">
                  <FieldLabel htmlFor="password">
                    {t("auth.login.passwordLabel")}
                  </FieldLabel>
                  <Link
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    href="/forgot-password"
                  >
                    {t("auth.login.forgotPassword")}
                  </Link>
                </div>
                <Input
                  autoComplete="current-password"
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
              <Field className="w-full">
                <Button className="w-full" disabled={submitting} type="submit">
                  {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
                </Button>
                <FieldDescription className="w-full text-center">
                  {t("auth.login.noAccount")}{" "}
                  <Link
                    className="font-medium text-foreground underline underline-offset-4"
                    href="/signup"
                  >
                    {t("auth.login.signUpLink")}
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
