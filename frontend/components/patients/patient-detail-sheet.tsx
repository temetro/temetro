"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { PatientDetail } from "@/components/patients/patient-detail";
import { TransferPatientDialog } from "@/components/patients/transfer-patient-dialog";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getPatient, type Patient } from "@/lib/patients";
import { hasClinicalAccess, useActiveRole } from "@/lib/roles";

type Status = "loading" | "ready" | "not-found";

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      {[0, 1, 2, 3].map((section) => (
        <div className="rounded-2xl border bg-card/30 p-4" key={section}>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <Skeleton className="h-3.5 w-full" key={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Right-side Sheet showing a patient's full record, laid out to fit the sheet
// width (see PatientDetail). Opened from the Patients table instead of routing
// into the AI chat.
export function PatientDetailSheet({
  fileNumber,
  open,
  onOpenChange,
}: {
  fileNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const role = useActiveRole();
  // Clinical roles can reassign a chart; show optimistically while role loads.
  const canTransfer = role == null || hasClinicalAccess(role);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  // Bumped on open so the editor remounts with the latest patient data.
  const [editKey, setEditKey] = useState(0);

  useEffect(() => {
    if (!open || !fileNumber) return;
    let active = true;
    setStatus("loading");
    setPatient(null);
    getPatient(fileNumber)
      .then((data) => {
        if (!active) return;
        setPatient(data);
        setStatus(data ? "ready" : "not-found");
      })
      .catch(() => {
        if (active) setStatus("not-found");
      });
    return () => {
      active = false;
    };
  }, [open, fileNumber]);

  const title =
    status === "ready" && patient
      ? patient.name
      : status === "not-found"
        ? t("patients.detail.notFound")
        : t("patients.detail.loading");

  return (
    <>
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetPopup className="sm:max-w-xl" side="right">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <SheetPanel className="min-h-0 flex-1">
            {status === "loading" && <DetailSkeleton />}
            {status === "not-found" && (
              <p className="text-muted-foreground text-sm">
                {t("patients.detail.noPatientForFile", { number: fileNumber })}
              </p>
            )}
            {status === "ready" && patient && (
              <PatientDetail
                onEdit={() => {
                  setEditKey((k) => k + 1);
                  setEditOpen(true);
                }}
                onTransfer={
                  canTransfer ? () => setTransferOpen(true) : undefined
                }
                patient={patient}
              />
            )}
          </SheetPanel>
        </SheetPopup>
      </Sheet>

      {patient && (
        <PatientFormDialog
          key={editKey}
          mode="edit"
          onOpenChange={setEditOpen}
          onSaved={(updated) => setPatient(updated)}
          open={editOpen}
          patient={patient}
        />
      )}

      {patient && (
        <TransferPatientDialog
          onOpenChange={setTransferOpen}
          onTransferred={(updated) => setPatient(updated)}
          open={transferOpen}
          patient={patient}
        />
      )}
    </>
  );
}
