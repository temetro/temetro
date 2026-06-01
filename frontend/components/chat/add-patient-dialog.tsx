"use client";

import { Plus, RefreshCw, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addPatient,
  type AllergySeverity,
  generateFileNumber,
  type Patient,
} from "@/lib/patients";

type AddPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (fileNumber: string) => void;
};

type AllergyDraft = { substance: string; reaction: string; severity: AllergySeverity };
type MedicationDraft = { name: string; dose: string; frequency: string };

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Button onClick={onAdd} size="sm" type="button" variant="ghost">
        <Plus className="size-4" />
        Add
      </Button>
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const today = () =>
  new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

export function AddPatientDialog({
  open,
  onOpenChange,
  onCreated,
}: AddPatientDialogProps) {
  // Lazily generate the file number on mount. The dialog is remounted (via a
  // `key`) each time it opens, so this gives a fresh number + cleared form
  // without a reset effect.
  const [fileNumber, setFileNumber] = useState(generateFileNumber);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Patient["sex"]>("F");
  const [status, setStatus] = useState<Patient["status"]>("active");
  const [pcp, setPcp] = useState("");
  const [bp, setBp] = useState("");
  const [hr, setHr] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [allergies, setAllergies] = useState<AllergyDraft[]>([]);
  const [medications, setMedications] = useState<MedicationDraft[]>([]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const patient: Patient = {
      fileNumber,
      name: name.trim(),
      age: Number(age) || 0,
      sex,
      pcp: pcp.trim() || "—",
      status,
      initials: initialsFromName(name),
      allergies: allergies.filter((a) => a.substance.trim()),
      alerts: [],
      medications: medications.filter((m) => m.name.trim()),
      problems: [],
      vitals: {
        bp: bp.trim() || "—",
        hr: hr.trim() || "—",
        temp: temp.trim() || "—",
        spo2: spo2.trim() || "—",
        takenAt: today(),
      },
      vitalsTrend: { label: "Heart rate", unit: "bpm", points: [] },
      labs: [],
      labTrend: { label: "—", unit: "", points: [] },
      encounters: [],
    };

    addPatient(patient);
    onCreated(fileNumber);
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add patient</DialogTitle>
          <DialogDescription>
            Create a new chart. A file number has been generated for you.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="File number">
            <div className="flex items-center gap-2">
              <Input readOnly value={fileNumber} />
              <Button
                aria-label="Regenerate file number"
                onClick={() => setFileNumber(generateFileNumber())}
                size="icon"
                type="button"
                variant="outline"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </Field>

          <Field label="Full name">
            <Input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jordan Pierce"
              required
              value={name}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Age">
              <Input
                inputMode="numeric"
                onChange={(event) => setAge(event.target.value)}
                placeholder="—"
                value={age}
              />
            </Field>
            <Field label="Sex">
              <select
                className={controlClass}
                onChange={(event) => setSex(event.target.value as Patient["sex"])}
                value={sex}
              >
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={controlClass}
                onChange={(event) =>
                  setStatus(event.target.value as Patient["status"])
                }
                value={status}
              >
                <option value="active">Active</option>
                <option value="inpatient">Inpatient</option>
                <option value="discharged">Discharged</option>
              </select>
            </Field>
          </div>

          <Field label="Primary care">
            <Input
              onChange={(event) => setPcp(event.target.value)}
              placeholder="e.g. Dr. Lena Ortiz"
              value={pcp}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Current vitals
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input
                aria-label="Blood pressure"
                onChange={(event) => setBp(event.target.value)}
                placeholder="BP"
                value={bp}
              />
              <Input
                aria-label="Heart rate"
                onChange={(event) => setHr(event.target.value)}
                placeholder="HR"
                value={hr}
              />
              <Input
                aria-label="Temperature"
                onChange={(event) => setTemp(event.target.value)}
                placeholder="Temp"
                value={temp}
              />
              <Input
                aria-label="Oxygen saturation"
                onChange={(event) => setSpo2(event.target.value)}
                placeholder="SpO₂"
                value={spo2}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SectionHeader
              label="Allergies"
              onAdd={() =>
                setAllergies((prev) => [
                  ...prev,
                  { substance: "", reaction: "", severity: "mild" },
                ])
              }
            />
            {allergies.map((allergy, index) => (
              <div className="flex items-center gap-2" key={index}>
                <Input
                  aria-label="Substance"
                  onChange={(event) =>
                    setAllergies((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, substance: event.target.value }
                          : row
                      )
                    )
                  }
                  placeholder="Substance"
                  value={allergy.substance}
                />
                <Input
                  aria-label="Reaction"
                  onChange={(event) =>
                    setAllergies((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, reaction: event.target.value }
                          : row
                      )
                    )
                  }
                  placeholder="Reaction"
                  value={allergy.reaction}
                />
                <select
                  aria-label="Severity"
                  className={cn(controlClass, "w-auto")}
                  onChange={(event) =>
                    setAllergies((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              severity: event.target.value as AllergySeverity,
                            }
                          : row
                      )
                    )
                  }
                  value={allergy.severity}
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <button
                  aria-label="Remove allergy"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() =>
                    setAllergies((prev) => prev.filter((_, i) => i !== index))
                  }
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <SectionHeader
              label="Medications"
              onAdd={() =>
                setMedications((prev) => [
                  ...prev,
                  { name: "", dose: "", frequency: "" },
                ])
              }
            />
            {medications.map((med, index) => (
              <div className="flex items-center gap-2" key={index}>
                <Input
                  aria-label="Medication name"
                  onChange={(event) =>
                    setMedications((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, name: event.target.value } : row
                      )
                    )
                  }
                  placeholder="Name"
                  value={med.name}
                />
                <Input
                  aria-label="Dose"
                  onChange={(event) =>
                    setMedications((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, dose: event.target.value } : row
                      )
                    )
                  }
                  placeholder="Dose"
                  value={med.dose}
                />
                <Input
                  aria-label="Frequency"
                  onChange={(event) =>
                    setMedications((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, frequency: event.target.value }
                          : row
                      )
                    )
                  }
                  placeholder="Frequency"
                  value={med.frequency}
                />
                <button
                  aria-label="Remove medication"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() =>
                    setMedications((prev) => prev.filter((_, i) => i !== index))
                  }
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!name.trim()} type="submit">
              Save patient
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
