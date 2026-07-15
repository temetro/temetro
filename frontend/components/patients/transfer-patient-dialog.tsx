"use client";

import { useEffect, useState } from "react";
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
import { ROLE_LABELS } from "@/lib/access";
import { type Patient, transferPatient } from "@/lib/patients";
import { listProviders, type Provider } from "@/lib/staff";
import { notify } from "@/lib/toast";

const selectClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

type Props = {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: (patient: Patient) => void;
};

// Reassign a patient to another clinician. The new provider becomes the
// patient's primary provider (and PCP label), which moves the chart into their
// panel under per-doctor visibility.
export function TransferPatientDialog({
  patient,
  open,
  onOpenChange,
  onTransferred,
}: Props) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState(patient.primaryProviderId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form each time the dialog opens. Adjusted during render so it
  // never paints the previous patient's provider.
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setProviderId(patient.primaryProviderId ?? "");
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    listProviders()
      .then((list) => active && setProviders(list))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, [open, patient.primaryProviderId]);

  const submit = async () => {
    if (!providerId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await transferPatient(patient.fileNumber, providerId);
      onTransferred(updated);
      notify.success(
        t("patients.transfer.successTitle"),
        t("patients.transfer.successBody", {
          name: updated.name,
          provider: updated.pcp,
        }),
      );
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("patients.transfer.error");
      setError(message);
      notify.error(t("patients.transfer.errorTitle"), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("patients.transfer.title")}</DialogTitle>
          <DialogDescription>
            {t("patients.transfer.description", { name: patient.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {error && (
            <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t("patients.transfer.providerLabel")}
            </span>
            <select
              className={selectClass}
              onChange={(e) => setProviderId(e.target.value)}
              value={providerId}
            >
              <option value="">{t("patients.transfer.choose")}</option>
              {providers.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name} ·{" "}
                  {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}
                </option>
              ))}
            </select>
          </label>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("patients.transfer.cancel")}
          </DialogClose>
          <Button
            disabled={
              submitting ||
              !providerId ||
              providerId === patient.primaryProviderId
            }
            onClick={submit}
            type="button"
          >
            {submitting
              ? t("patients.transfer.transferring")
              : t("patients.transfer.confirm")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
