"use client";

import { Check, Loader2, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
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
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import {
  commitWalletShare,
  type Patient,
  pollWalletShare,
  requestWalletShare,
  type WalletShareRequest,
} from "@/lib/patients";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Phase =
  | "form"
  | "requesting"
  | "waiting"
  | "approved"
  | "denied"
  | "expired"
  | "error";

const DURATIONS = [
  { hours: 1, key: "hours", count: 1 },
  { hours: 24, key: "days", count: 1 },
  { hours: 168, key: "days", count: 7 },
] as const;

const POLL_INTERVAL = 2500;
const POLL_TIMEOUT = 3 * 60 * 1000;

export function ImportFromWalletDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (fileNumber: string) => void;
}) {
  const { t } = useTranslation();
  const [walletNumber, setWalletNumber] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<WalletShareRequest | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  // Reset everything whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setWalletNumber("");
      setTemporary(false);
      setDurationHours(24);
      setPhase("form");
      setError(null);
      setRequest(null);
      setReviewOpen(false);
    }
    return stopPolling;
  }, [open]);

  // Poll the request until the patient approves/denies on their device.
  useEffect(() => {
    if (phase !== "waiting" || !request) return;
    const startedAt = Date.now();
    pollTimer.current = setInterval(async () => {
      try {
        const next = await pollWalletShare(request.id);
        if (next.status === "approved") {
          stopPolling();
          setRequest(next);
          setPhase("approved");
        } else if (next.status === "denied") {
          stopPolling();
          setPhase("denied");
        } else if (
          next.status === "expired" ||
          Date.now() - startedAt > POLL_TIMEOUT
        ) {
          stopPolling();
          setPhase("expired");
        }
      } catch {
        /* transient — keep polling until timeout */
        if (Date.now() - startedAt > POLL_TIMEOUT) {
          stopPolling();
          setPhase("expired");
        }
      }
    }, POLL_INTERVAL);
    return stopPolling;
  }, [phase, request]);

  const sendRequest = async () => {
    setPhase("requesting");
    setError(null);
    try {
      const req = await requestWalletShare({
        walletNumber: walletNumber.trim(),
        mode: temporary ? "temporary" : "permanent",
        durationHours: temporary ? durationHours : undefined,
      });
      setRequest(req);
      setPhase("waiting");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(t("patients.importApp.invalidWallet"));
      } else {
        setError(t("patients.importApp.error"));
      }
      setPhase("error");
    }
  };

  const commitDraft = async (record: Patient) => {
    if (!request) return;
    try {
      const saved = await commitWalletShare(request.id, record);
      setReviewOpen(false);
      onOpenChange(false);
      onImported?.(saved.fileNumber);
      notify.success(
        t("patients.importApp.savedTitle"),
        t("patients.importApp.savedBody", { name: saved.name }),
      );
    } catch (err) {
      notify.error(
        t("patients.importApp.errorTitle"),
        err instanceof Error ? err.message : t("patients.importApp.error"),
      );
    }
  };

  const durationLabel = (d: (typeof DURATIONS)[number]) =>
    t(`patients.importApp.${d.key}`, { count: d.count });

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-4" />
              {t("patients.importApp.title")}
            </DialogTitle>
            <DialogDescription>
              {t("patients.importApp.description")}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="flex flex-col gap-4">
            {phase === "waiting" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="font-medium text-sm">
                  {t("patients.importApp.waitingTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("patients.importApp.waitingBody")}
                </p>
              </div>
            ) : phase === "approved" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Check className="size-8 text-emerald-500" />
                <p className="font-medium text-sm">
                  {t("patients.importApp.approvedTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("patients.importApp.approvedBody")}
                </p>
                <Button onClick={() => setReviewOpen(true)} type="button">
                  {t("patients.importApp.review")}
                </Button>
              </div>
            ) : phase === "denied" || phase === "expired" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <X className="size-8 text-muted-foreground" />
                <p className="font-medium text-sm">
                  {t(`patients.importApp.${phase}Title`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`patients.importApp.${phase}Body`)}
                </p>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {t("patients.importApp.walletLabel")}
                  </span>
                  <Input
                    autoFocus
                    disabled={phase === "requesting"}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    placeholder={t("patients.importApp.walletPlaceholder")}
                    value={walletNumber}
                  />
                </label>

                <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/30 p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">
                      {t("patients.importApp.tempLabel")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("patients.importApp.tempHint")}
                    </p>
                  </div>
                  <Switch
                    checked={temporary}
                    disabled={phase === "requesting"}
                    onCheckedChange={(v) => setTemporary(v)}
                  />
                </div>

                {temporary ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {t("patients.importApp.durationLabel")}
                    </span>
                    <div className="flex gap-2">
                      {DURATIONS.map((d) => (
                        <Button
                          className={cn(
                            "flex-1 rounded-2xl",
                            durationHours !== d.hours &&
                              "bg-transparent text-foreground",
                          )}
                          key={d.hours}
                          onClick={() => setDurationHours(d.hours)}
                          size="sm"
                          type="button"
                          variant={
                            durationHours === d.hours ? "default" : "outline"
                          }
                        >
                          {durationLabel(d)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </>
            )}
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {phase === "approved" || phase === "denied" || phase === "expired"
                ? t("patients.importApp.close")
                : t("patients.importApp.cancel")}
            </DialogClose>
            {phase === "form" || phase === "requesting" || phase === "error" ? (
              <Button
                disabled={!walletNumber.trim() || phase === "requesting"}
                onClick={sendRequest}
                type="button"
              >
                {phase === "requesting"
                  ? t("patients.importApp.requesting")
                  : t("patients.importApp.request")}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Review the shared record in the full patient form (review mode — the
          form emits the draft, we commit it via the wallet-share endpoint). */}
      {request?.draft ? (
        <PatientFormDialog
          mode="edit"
          onDraft={commitDraft}
          onOpenChange={setReviewOpen}
          open={reviewOpen}
          patient={request.draft}
        />
      ) : null}
    </>
  );
}
