"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/settings/settings-parts";
import { authClient } from "@/lib/auth-client";

// Confirms (with the user's password) before permanently deleting the account
// via Better Auth's deleteUser, then bounces to /login.
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (next: boolean) => {
    if (!next) {
      setPassword("");
      setError(null);
      setDeleting(false);
    }
    onOpenChange(next);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    const { error: err } = await authClient.deleteUser({ password });
    if (err) {
      setError(err.message ?? t("settings.profile.deleteDialog.failed"));
      setDeleting(false);
      return;
    }
    // Sessions are revoked server-side; send the user back to login.
    window.location.href = "/login";
  };

  return (
    <Dialog onOpenChange={reset} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            {t("settings.profile.deleteDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.profile.deleteDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <FieldLabel required>
              {t("settings.profile.deleteDialog.passwordLabel")}
            </FieldLabel>
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t(
                "settings.profile.deleteDialog.passwordPlaceholder",
              )}
              type="password"
              value={password}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("settings.profile.deleteDialog.cancel")}
          </DialogClose>
          <Button
            disabled={deleting || password.length === 0}
            onClick={confirmDelete}
            type="button"
            variant="destructive"
          >
            {deleting
              ? t("settings.profile.deleteDialog.deleting")
              : t("settings.profile.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
