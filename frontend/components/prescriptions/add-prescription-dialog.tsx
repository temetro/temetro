"use client";

import { AlertTriangle, Search } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { listPatients, type Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";

export type NewPrescription = {
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  frequency: string;
  duration: string;
};

const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Every 8 hours",
  "As needed",
];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

// Mock pharmacology: pairs of drug keywords known to interact. Checked against
// the patient's current medications. Not clinical advice — illustrative only.
const INTERACTIONS: [string, string][] = [
  ["warfarin", "aspirin"],
  ["warfarin", "ibuprofen"],
  ["lisinopril", "potassium"],
  ["lisinopril", "spironolactone"],
  ["simvastatin", "clarithromycin"],
  ["metformin", "contrast"],
  ["amoxicillin", "methotrexate"],
];

const has = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

// Find interaction/allergy conflicts between a new medication and the patient's
// existing record. Returns human-readable warning lines.
function findConflicts(medication: string, patient: Patient): string[] {
  const med = medication.trim();
  if (med.length < 3) return [];
  const conflicts: string[] = [];

  for (const allergy of patient.allergies) {
    if (has(med, allergy.substance) || has(allergy.substance, med)) {
      conflicts.push(
        `Allergy: patient is allergic to ${allergy.substance} (${allergy.reaction}).`,
      );
    }
  }

  for (const current of patient.medications) {
    for (const [a, b] of INTERACTIONS) {
      const hit =
        (has(med, a) && has(current.name, b)) ||
        (has(med, b) && has(current.name, a));
      if (hit) {
        conflicts.push(`May interact with ${current.name} (current medication).`);
      }
    }
  }

  return [...new Set(conflicts)];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// Compact "New prescription" dialog. The patient is chosen via a quick search by
// name or file number (same pattern as the appointment dialog); the rest is the
// medication detail. Prescriptions are mock-only, so the new entry is handed back
// to the page via onAdd.
export function AddPrescriptionDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (rx: NewPrescription) => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [medication, setMedication] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [duration, setDuration] = useState("");

  // Load patients lazily when the dialog opens (for the quick search).
  useEffect(() => {
    if (!open) return;
    let active = true;
    listPatients()
      .then((data) => {
        if (active) setPatients(data);
      })
      .catch(() => {
        /* search just stays empty */
      });
    return () => {
      active = false;
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) => p.name.toLowerCase().includes(q) || p.fileNumber.includes(q),
      )
      .slice(0, 6);
  }, [patients, query]);

  const conflicts = useMemo(
    () => (selected ? findConflicts(medication, selected) : []),
    [medication, selected],
  );

  const reset = () => {
    setQuery("");
    setSelected(null);
    setMedication("");
    setDose("");
    setFrequency(FREQUENCIES[0]);
    setDuration("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) {
      notify.error("Pick a patient", "Search and select a patient first.");
      return;
    }
    if (!medication.trim()) {
      notify.error("Add a medication", "Enter the medication name.");
      return;
    }
    onAdd({
      fileNumber: selected.fileNumber,
      name: selected.name,
      initials: selected.initials,
      medication: medication.trim(),
      dose: dose.trim(),
      frequency,
      duration: duration.trim(),
    });
    notify.success("Prescription added", `${medication.trim()} for ${selected.name}`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      open={open}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New prescription</DialogTitle>
          <DialogDescription>
            Search for a patient by name or file number, then set the medication.
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label="Patient">
              {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border bg-input/30 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {selected.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      File #{selected.fileNumber}
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setSelected(null);
                      setQuery("");
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      className="pl-9"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search name or file number"
                      value={query}
                    />
                  </div>
                  {query.trim() && (
                    <div className="max-h-56 overflow-y-auto rounded-2xl border bg-popover p-1">
                      {matches.length === 0 ? (
                        <p className="px-2 py-2 text-muted-foreground text-sm">
                          No patients found.
                        </p>
                      ) : (
                        matches.map((p) => (
                          <button
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                            key={p.fileNumber}
                            onClick={() => {
                              setSelected(p);
                              setQuery("");
                            }}
                            type="button"
                          >
                            <span className="truncate text-foreground text-sm">
                              {p.name}
                            </span>
                            <span className="shrink-0 text-muted-foreground text-xs">
                              #{p.fileNumber}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <Field label="Medication">
              <Input
                onChange={(event) => setMedication(event.target.value)}
                placeholder="e.g. Amoxicillin"
                value={medication}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Dose">
                <Input
                  onChange={(event) => setDose(event.target.value)}
                  placeholder="e.g. 500 mg"
                  value={dose}
                />
              </Field>
              <Field label="Frequency">
                <select
                  className={controlClass}
                  onChange={(event) => setFrequency(event.target.value)}
                  value={frequency}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Duration">
              <Input
                onChange={(event) => setDuration(event.target.value)}
                placeholder="e.g. 7 days"
                value={duration}
              />
            </Field>

            {conflicts.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Possible interaction</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc ps-4">
                    {conflicts.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!selected} type="submit">
              Add prescription
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
