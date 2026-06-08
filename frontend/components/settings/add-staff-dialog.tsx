"use client";

import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/access";
import { apiFetch } from "@/lib/api-client";
import { PROVISIONABLE_ROLES } from "@/lib/roles";
import { notify } from "@/lib/toast";

const MIN_PASSWORD = 12;
const MIN_USERNAME = 3;

const selectClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

// Admin provisions a staff account in two steps: first the "invitation" (who +
// what role), then the credentials (username + password) the employee uses to
// sign in. Posts to /api/staff, which creates the account and adds them to the
// active clinic via Better Auth.
export function AddStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("reception");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setName("");
    setRole("reception");
    setUsername("");
    setPassword("");
    setError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Step 1 → advance to credentials.
    if (step === 1) {
      if (!name.trim()) {
        setError(t("settings.careTeam.add.nameRequired"));
        return;
      }
      setStep(2);
      return;
    }

    // Step 2 → create the account.
    if (username.trim().length < MIN_USERNAME) {
      setError(t("settings.careTeam.add.usernameTooShort", { count: MIN_USERNAME }));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t("settings.careTeam.add.passwordTooShort", { count: MIN_PASSWORD }));
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/staff", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          role,
          username: username.trim(),
          password,
        }),
      });
      notify.success(
        t("settings.careTeam.add.createdTitle"),
        t("settings.careTeam.add.createdBody", {
          name: name.trim(),
          username: username.trim().toLowerCase(),
        }),
      );
      onCreated?.();
      handleOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("settings.careTeam.add.error");
      setError(message);
      notify.error(t("settings.careTeam.add.errorTitle"), message);
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.careTeam.add.title")}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? t("settings.careTeam.add.step1Description")
              : t("settings.careTeam.add.step2Description")}
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            {error && (
              <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {step === 1 ? (
              <>
                <Field className="w-full">
                  <FieldLabel htmlFor="staff-name">
                    {t("settings.careTeam.add.nameLabel")}
                  </FieldLabel>
                  <Input
                    autoFocus
                    id="staff-name"
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("settings.careTeam.add.namePlaceholder")}
                    required
                    value={name}
                  />
                </Field>
                <Field className="w-full">
                  <FieldLabel htmlFor="staff-role">
                    {t("settings.careTeam.add.roleLabel")}
                  </FieldLabel>
                  <select
                    className={selectClass}
                    id="staff-role"
                    onChange={(e) => setRole(e.target.value)}
                    value={role}
                  >
                    {PROVISIONABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field className="w-full">
                  <FieldLabel htmlFor="staff-username">
                    {t("settings.careTeam.add.usernameLabel")}
                  </FieldLabel>
                  <Input
                    autoComplete="off"
                    autoFocus
                    id="staff-username"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("settings.careTeam.add.usernamePlaceholder")}
                    required
                    value={username}
                  />
                </Field>
                <Field className="w-full">
                  <FieldLabel htmlFor="staff-password">
                    {t("settings.careTeam.add.passwordLabel")}
                  </FieldLabel>
                  <Input
                    autoComplete="new-password"
                    id="staff-password"
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                  <FieldDescription>
                    {t("settings.careTeam.add.passwordHint", { count: MIN_PASSWORD })}
                  </FieldDescription>
                </Field>
              </>
            )}
          </DialogPanel>

          <DialogFooter>
            {step === 2 && (
              <Button
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                type="button"
                variant="outline"
              >
                {t("settings.careTeam.add.back")}
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {t("settings.careTeam.add.cancel")}
            </DialogClose>
            <Button disabled={submitting} type="submit">
              {step === 1
                ? t("settings.careTeam.add.next")
                : submitting
                  ? t("settings.careTeam.add.creating")
                  : t("settings.careTeam.add.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
