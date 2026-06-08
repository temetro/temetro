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
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Mode = "email" | "username";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation();
  const router = useRouter();
  // Staff provisioned by an admin sign in with a username; clinic owners sign in
  // with the email they signed up with. The tab picks which credential to use.
  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const callbackURL = `${window.location.origin}/`;
    const { error: err } =
      mode === "email"
        ? await authClient.signIn.email({
            email: identifier.trim(),
            password,
            callbackURL,
          })
        : await authClient.signIn.username({
            username: identifier.trim(),
            password,
            callbackURL,
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
              <Tabs
                onValueChange={(value) => {
                  setMode(value as Mode);
                  setError(null);
                }}
                value={mode}
              >
                <TabsList className="w-full">
                  <TabsTab className="flex-1" value="email">
                    {t("auth.login.tabEmail")}
                  </TabsTab>
                  <TabsTab className="flex-1" value="username">
                    {t("auth.login.tabUsername")}
                  </TabsTab>
                </TabsList>
              </Tabs>
              <Field>
                <FieldLabel htmlFor="identifier">
                  {mode === "email"
                    ? t("auth.login.emailLabel")
                    : t("auth.login.usernameLabel")}
                </FieldLabel>
                <Input
                  autoComplete={mode === "email" ? "email" : "username"}
                  id="identifier"
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    mode === "email"
                      ? t("auth.login.emailPlaceholder")
                      : t("auth.login.usernamePlaceholder")
                  }
                  required
                  type={mode === "email" ? "email" : "text"}
                  value={identifier}
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
