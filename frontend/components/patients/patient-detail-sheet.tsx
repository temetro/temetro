"use client";

import { useEffect, useState } from "react";

import { PatientResult } from "@/components/chat/patient-cards";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { getPatient, type Patient } from "@/lib/patients";

type Status = "loading" | "ready" | "not-found";

// Right-side Sheet showing a patient's full record. Reuses the chat's
// PatientResult cards in their vertical (column) layout. Opened from the
// Patients table instead of routing into the AI chat.
export function PatientDetailSheet({
  fileNumber,
  open,
  onOpenChange,
}: {
  fileNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [status, setStatus] = useState<Status>("loading");

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
        ? "Patient not found"
        : "Loading patient…";

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SheetPanel className="min-h-0 flex-1">
          {fileNumber && (
            <PatientResult
              fileNumber={fileNumber}
              layout="column"
              onPatientUpdated={setPatient}
              patient={patient ?? undefined}
              status={status}
            />
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
