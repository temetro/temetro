"use client";

import { Check, Loader2, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import type { Patient } from "@/lib/patients";
import { cn } from "@/lib/utils";
import {
  getWalletUpdate,
  pushWalletUpdate,
  type WalletUpdate,
} from "@/lib/wallet-updates";

// The record sections a clinician can flag as changed. The labels double as the
// human-readable change summary the patient sees when approving.
const SECTION_KEYS = [
  "demographics",
  "problems",
  "medications",
  "allergies",
  "labs",
  "vitals",
  "visits",
] as const;

type Phase = "compose" | "sent";

// Push the current record to a wallet-linked patient's app. The patient must
// approve it on their phone before their on-device record is replaced.
export function WalletPushDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("compose");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [update, setUpdate] = useState<WalletUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase("compose");
    setSelected(new Set());
    setNote("");
    setUpdate(null);
    setBusy(false);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Poll the update's status until the patient approves/denies (or the dialog
  // closes). Live pushes usually resolve within seconds.
  useEffect(() => {
    if (phase !== "sent" || !update || update.resolvedAt) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const fresh = await getWalletUpdate(update.id);
        if (!active) return;
        setUpdate(fresh);
        if (fresh.resolvedAt) clearInterval(timer);
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [phase, update]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const push = async () => {
    setBusy(true);
    setError(null);
    try {
      const changes = [
        ...[...selected].map((k) => t(`walletPush.sections.${k}`)),
        ...(note.trim() ? [note.trim()] : []),
      ];
      const created = await pushWalletUpdate({
        fileNumber: patient.fileNumber,
        changes,
      });
      setUpdate(created);
      setPhase("sent");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("walletPush.errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  };

  const canPush = selected.size > 0 || note.trim().length > 0;
  const status = update?.status ?? "pending";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="flex max-h-[85dvh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            {t("walletPush.title")}
          </DialogTitle>
          <DialogDescription>
            {t("walletPush.subtitle", { name: patient.name })}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="min-h-0 flex-1 overflow-y-auto">
          {phase === "compose" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t("walletPush.sectionsLabel")}</Label>
                <div className="flex flex-wrap gap-2">
                  {SECTION_KEYS.map((key) => {
                    const on = selected.has(key);
                    return (
                      <button
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors",
                          on
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                        key={key}
                        onClick={() => toggle(key)}
                        type="button"
                      >
                        {t(`walletPush.sections.${key}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wallet-push-note">
                  {t("walletPush.noteLabel")}
                </Label>
                <Textarea
                  className="min-h-20"
                  id="wallet-push-note"
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("walletPush.notePlaceholder")}
                  value={note}
                />
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-xs">
                {t("walletPush.notice")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              {status === "approved" ? (
                <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-6" />
                </div>
              ) : status === "denied" ? (
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                  <X className="size-6" />
                </div>
              ) : (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              )}
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground text-sm">
                  {t(`walletPush.status.${status}.title`)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t(`walletPush.status.${status}.body`)}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </DialogPanel>

        <DialogFooter>
          {phase === "compose" ? (
            <>
              <Button
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("walletPush.cancel")}
              </Button>
              <Button disabled={busy || !canPush} onClick={push} type="button">
                {busy && <Spinner className="size-4" />}
                {t("walletPush.send")}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)} type="button">
              {t("walletPush.done")}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
