"use client";

import { Check, Loader2, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogFooter, DialogPanel } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { UseWalletSync } from "./use-wallet-sync";

// Two-step header shown at the top of a dialog when the selected patient has a
// linked wallet: "Details" → "Sync to wallet".
export function DialogStepper({ step }: { step: "form" | "wallet" }) {
  const { t } = useTranslation();
  const steps = [
    { key: "form", label: t("walletSync.step1") },
    { key: "wallet", label: t("walletSync.step2") },
  ] as const;
  const activeIndex = step === "form" ? 0 : 1;

  return (
    <div className="mt-3 flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div className="flex flex-1 items-center gap-2" key={s.key}>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/15 text-primary ring-1 ring-primary/40",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                active || done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "ml-1 h-px flex-1",
                  done ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step 2 body + footer: offer to push the just-saved change to the patient's
// wallet, then show the approval status. Rendered in place of the form's
// DialogPanel/DialogFooter, so it returns them as a fragment.
export function WalletSyncStep({
  patientName,
  summary,
  sync,
  onDone,
}: {
  patientName: string;
  summary: string;
  sync: UseWalletSync;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { state, update, error, push } = sync;
  const status = update?.status ?? "pending";

  return (
    <>
      <DialogPanel className="min-h-0 flex-1 overflow-y-auto">
        {state === "idle" || state === "error" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground text-sm">
                {t("walletSync.prompt", { name: patientName })}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("walletSync.promptBody")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">
                {t("walletSync.changesLabel")}
              </span>
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-foreground text-sm">
                {summary}
              </div>
            </div>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error === "generic" ? t("walletSync.errors.generic") : error}
              </p>
            )}
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
      </DialogPanel>

      <DialogFooter>
        {state === "idle" || state === "error" ? (
          <>
            <Button onClick={onDone} type="button" variant="outline">
              {t("walletSync.skip")}
            </Button>
            <Button onClick={() => push([summary])} type="button">
              <Send className="size-4" />
              {t("walletSync.send")}
            </Button>
          </>
        ) : (
          <Button onClick={onDone} type="button">
            {t("walletSync.done")}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
