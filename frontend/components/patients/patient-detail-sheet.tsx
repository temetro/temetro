"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { RecordGraph } from "@/components/graph/record-graph";
import { PatientDetail } from "@/components/patients/patient-detail";
import { ScribeDialog } from "@/components/patients/scribe-dialog";
import { TransferPatientDialog } from "@/components/patients/transfer-patient-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { type Appointment, listAppointments } from "@/lib/appointments";
import { type Invoice, listInvoices } from "@/lib/invoices";
import { deletePatient, getPatient, type Patient } from "@/lib/patients";
import { listPrescriptions, type Prescription } from "@/lib/prescriptions";
import { useAiAccess } from "@/lib/ai-policy";
import { hasClinicalAccess, useActiveRole } from "@/lib/roles";
import { notify } from "@/lib/toast";

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
  // Deleting a chart is destructive — only offer it once we know the role is
  // a full clinician (patient:delete), never optimistically.
  const canDelete = role != null && hasClinicalAccess(role);
  // The ambient scribe writes a clinical note, so it needs full clinical write
  // access AND the clinic's AI must be enabled for this member.
  const { allowed: aiAllowed } = useAiAccess();
  const canScribe = role != null && hasClinicalAccess(role) && aiAllowed;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [editOpen, setEditOpen] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Graph popped out of the sheet into its own dialog (the sheet closes first).
  const [graphOpen, setGraphOpen] = useState(false);
  // Related records aggregated into the sheet for a 360° view.
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Bumped on open so the editor remounts with the latest patient data.
  const [editKey, setEditKey] = useState(0);

  useEffect(() => {
    if (!open || !fileNumber) return;
    let active = true;
    setStatus("loading");
    setPatient(null);
    setPrescriptions([]);
    setAppointments([]);
    setInvoices([]);
    getPatient(fileNumber)
      .then((data) => {
        if (!active) return;
        setPatient(data);
        setStatus(data ? "ready" : "not-found");
      })
      .catch(() => {
        if (active) setStatus("not-found");
      });
    // Pull related records in parallel; filter to this chart. Best-effort — a
    // missing permission (e.g. reception + prescriptions) just leaves it empty.
    const forFile = (fn: string) => fn === fileNumber;
    listPrescriptions()
      .then((rx) => active && setPrescriptions(rx.filter((r) => forFile(r.fileNumber))))
      .catch(() => {});
    listAppointments()
      .then((a) => active && setAppointments(a.filter((r) => forFile(r.fileNumber))))
      .catch(() => {});
    listInvoices()
      .then((i) => active && setInvoices(i.filter((r) => forFile(r.fileNumber))))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, fileNumber]);

  const remove = async () => {
    if (!patient) return;
    try {
      await deletePatient(patient.fileNumber);
      notify.success(t("patients.delete.doneTitle"), patient.name);
      onOpenChange(false);
    } catch {
      notify.error(
        t("patients.delete.failedTitle"),
        t("patients.delete.failedBody"),
      );
    }
  };

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
            <SheetTitle className="flex items-center gap-2">
              {title}
              {status === "ready" && <AiBadge source={patient?.source} />}
            </SheetTitle>
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
                appointments={appointments}
                invoices={invoices}
                onDelete={canDelete ? () => setConfirmOpen(true) : undefined}
                onEdit={() => {
                  setEditKey((k) => k + 1);
                  setEditOpen(true);
                }}
                onScribe={canScribe ? () => setScribeOpen(true) : undefined}
                onOpenGraph={() => {
                  onOpenChange(false);
                  setGraphOpen(true);
                }}
                onTransfer={
                  canTransfer ? () => setTransferOpen(true) : undefined
                }
                patient={patient}
                prescriptions={prescriptions}
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
        <ScribeDialog
          onOpenChange={setScribeOpen}
          onSaved={(updated) => setPatient(updated)}
          open={scribeOpen}
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

      {patient && (
        <ConfirmDialog
          cancelLabel={t("patients.delete.cancel")}
          confirmLabel={t("patients.delete.confirm")}
          description={t("patients.delete.body", { name: patient.name })}
          onConfirm={remove}
          onOpenChange={setConfirmOpen}
          open={confirmOpen}
          title={t("patients.delete.title")}
        />
      )}

      {patient && (
        <Dialog onOpenChange={setGraphOpen} open={graphOpen}>
          <DialogPopup className="flex h-[80dvh] flex-col sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {t("patientCard.graph.title")} · {patient.name}
              </DialogTitle>
              <DialogDescription>
                {t("patientCard.graph.hint")}
              </DialogDescription>
            </DialogHeader>
            <RecordGraph
              className="h-full min-h-0 flex-1 border-0 bg-transparent"
              patient={patient}
            />
          </DialogPopup>
        </Dialog>
      )}
    </>
  );
}
