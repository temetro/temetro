"use client";

import { CalendarIcon, Plus, RefreshCw, X } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import {
  type AllergySeverity,
  createPatient,
  generateFileNumber,
  type LabFlag,
  type Patient,
  updatePatient,
} from "@/lib/patients";

type PatientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  patient?: Patient;
  onCreated?: (fileNumber: string) => void;
  onSaved?: (patient: Patient) => void;
};

type AllergyDraft = { substance: string; reaction: string; severity: AllergySeverity };
type MedicationDraft = { name: string; dose: string; frequency: string };
type ProblemDraft = { label: string; since: string };
type LabDraft = { name: string; value: string; flag: LabFlag; takenAt: string };
type VisitDraft = { type: string; date: string; provider: string; summary: string };

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

function SectionList<T>({
  label,
  rows,
  blank,
  onChange,
  render,
}: {
  label: string;
  rows: T[];
  blank: T;
  onChange: (rows: T[]) => void;
  render: (row: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <Button
          onClick={() => onChange([...rows, blank])}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {rows.map((row, index) => (
        <div className="flex items-center gap-2" key={index}>
          {render(row, (patch) =>
            onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
          )}
          <button
            aria-label={`Remove ${label} row`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
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

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

const today = () => formatDate(new Date());

// Patient dates are stored as formatted strings (e.g. "Jun 02, 2026"); parse one
// back to a Date so the calendar can highlight the current selection.
function parseDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Calendar-backed date field that reads/writes the same formatted string the rest
// of the form uses.
function DatePicker({
  value,
  onChange,
  ariaLabel,
  placeholder = "Pick a date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={ariaLabel}
            className={cn(
              "justify-start font-normal",
              !value && "text-muted-foreground",
              className
            )}
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarIcon className="size-4" />
        <span className="truncate">{value || placeholder}</span>
      </PopoverTrigger>
      <PopoverPopup className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(date) => {
            onChange(date ? formatDate(date) : "");
            setOpen(false);
          }}
          selected={parseDate(value)}
        />
      </PopoverPopup>
    </Popover>
  );
}

export function PatientFormDialog({
  open,
  onOpenChange,
  mode,
  patient,
  onCreated,
  onSaved,
}: PatientFormDialogProps) {
  const isEdit = mode === "edit";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileNumber, setFileNumber] = useState(() =>
    isEdit && patient ? patient.fileNumber : generateFileNumber()
  );
  const [name, setName] = useState(patient?.name ?? "");
  const [age, setAge] = useState(patient ? String(patient.age) : "");
  const [sex, setSex] = useState<Patient["sex"]>(patient?.sex ?? "F");
  const [status, setStatus] = useState<Patient["status"]>(
    patient?.status ?? "active"
  );
  const [pcp, setPcp] = useState(patient?.pcp ?? "");
  const [bp, setBp] = useState(patient?.vitals.bp ?? "");
  const [hr, setHr] = useState(patient?.vitals.hr ?? "");
  const [temp, setTemp] = useState(patient?.vitals.temp ?? "");
  const [spo2, setSpo2] = useState(patient?.vitals.spo2 ?? "");
  const [allergies, setAllergies] = useState<AllergyDraft[]>(
    () => patient?.allergies.map((a) => ({ ...a })) ?? []
  );
  const [medications, setMedications] = useState<MedicationDraft[]>(
    () => patient?.medications.map((m) => ({ ...m })) ?? []
  );
  const [problems, setProblems] = useState<ProblemDraft[]>(
    () => patient?.problems.map((p) => ({ ...p })) ?? []
  );
  const [labs, setLabs] = useState<LabDraft[]>(
    () => patient?.labs.map((l) => ({ ...l })) ?? []
  );
  const [visits, setVisits] = useState<VisitDraft[]>(
    () =>
      patient?.encounters.map((e) => ({
        type: e.type,
        date: e.date,
        provider: e.provider,
        summary: e.summary,
      })) ?? []
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || submitting) {
      return;
    }

    const built: Patient = {
      fileNumber,
      name: name.trim(),
      age: Number(age) || 0,
      sex,
      pcp: pcp.trim() || "—",
      status,
      initials: initialsFromName(name),
      allergies: allergies.filter((a) => a.substance.trim()),
      alerts: patient?.alerts ?? [],
      medications: medications.filter((m) => m.name.trim()),
      problems: problems.filter((p) => p.label.trim()),
      vitals: {
        bp: bp.trim() || "—",
        hr: hr.trim() || "—",
        temp: temp.trim() || "—",
        spo2: spo2.trim() || "—",
        takenAt: isEdit ? (patient?.vitals.takenAt ?? today()) : today(),
      },
      vitalsTrend: patient?.vitalsTrend ?? {
        label: "Heart rate",
        unit: "bpm",
        points: [],
      },
      labs: labs
        .filter((l) => l.name.trim())
        .map((l) => ({ ...l, takenAt: l.takenAt.trim() || today() })),
      labTrend: patient?.labTrend ?? { label: "—", unit: "", points: [] },
      encounters: visits
        .filter((v) => v.type.trim() || v.summary.trim())
        .map((v) => ({
          type: v.type.trim() || "Visit",
          date: v.date.trim() || today(),
          provider: v.provider,
          summary: v.summary,
        })),
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = isEdit
        ? await updatePatient(built)
        : await createPatient(built);
      if (isEdit) {
        onSaved?.(saved);
      } else {
        onCreated?.(saved.fileNumber);
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the patient.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="max-h-[85dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit record" : "Add patient"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update ${patient?.name ?? "this"}'s chart and add new data.`
              : "Create a new chart. A file number has been generated for you."}
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={handleSubmit}>
          <DialogPanel
            scrollFade={false}
            className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
          >
            <Field label="File number">
              <div className="flex items-center gap-2">
                <Input readOnly value={fileNumber} />
                {!isEdit && (
                  <Button
                    aria-label="Regenerate file number"
                    onClick={() => setFileNumber(generateFileNumber())}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                )}
              </div>
            </Field>

            <Field label="Full name">
              <Input
                autoFocus={!isEdit}
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
                  onChange={(event) =>
                    setSex(event.target.value as Patient["sex"])
                  }
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

            <SectionList<AllergyDraft>
              blank={{ substance: "", reaction: "", severity: "mild" }}
              label="Allergies"
              onChange={setAllergies}
              render={(row, set) => (
                <>
                  <Input
                    aria-label="Substance"
                    onChange={(event) => set({ substance: event.target.value })}
                    placeholder="Substance"
                    value={row.substance}
                  />
                  <Input
                    aria-label="Reaction"
                    onChange={(event) => set({ reaction: event.target.value })}
                    placeholder="Reaction"
                    value={row.reaction}
                  />
                  <select
                    aria-label="Severity"
                    className={cn(controlClass, "w-auto")}
                    onChange={(event) =>
                      set({ severity: event.target.value as AllergySeverity })
                    }
                    value={row.severity}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </>
              )}
              rows={allergies}
            />

            <SectionList<MedicationDraft>
              blank={{ name: "", dose: "", frequency: "" }}
              label="Medications"
              onChange={setMedications}
              render={(row, set) => (
                <>
                  <Input
                    aria-label="Medication name"
                    onChange={(event) => set({ name: event.target.value })}
                    placeholder="Name"
                    value={row.name}
                  />
                  <Input
                    aria-label="Dose"
                    onChange={(event) => set({ dose: event.target.value })}
                    placeholder="Dose"
                    value={row.dose}
                  />
                  <Input
                    aria-label="Frequency"
                    onChange={(event) => set({ frequency: event.target.value })}
                    placeholder="Frequency"
                    value={row.frequency}
                  />
                </>
              )}
              rows={medications}
            />

            <SectionList<ProblemDraft>
              blank={{ label: "", since: "" }}
              label="Problems"
              onChange={setProblems}
              render={(row, set) => (
                <>
                  <Input
                    aria-label="Problem"
                    onChange={(event) => set({ label: event.target.value })}
                    placeholder="Diagnosis"
                    value={row.label}
                  />
                  <DatePicker
                    ariaLabel="Since"
                    className="w-40 shrink-0"
                    onChange={(since) => set({ since })}
                    placeholder="Since"
                    value={row.since}
                  />
                </>
              )}
              rows={problems}
            />

            <SectionList<LabDraft>
              blank={{ name: "", value: "", flag: "normal", takenAt: "" }}
              label="Labs"
              onChange={setLabs}
              render={(row, set) => (
                <>
                  <Input
                    aria-label="Lab name"
                    onChange={(event) => set({ name: event.target.value })}
                    placeholder="Test"
                    value={row.name}
                  />
                  <Input
                    aria-label="Value"
                    onChange={(event) => set({ value: event.target.value })}
                    placeholder="Value"
                    value={row.value}
                  />
                  <select
                    aria-label="Flag"
                    className={cn(controlClass, "w-auto")}
                    onChange={(event) => set({ flag: event.target.value as LabFlag })}
                    value={row.flag}
                  >
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </>
              )}
              rows={labs}
            />

            <SectionList<VisitDraft>
              blank={{ type: "", date: "", provider: "", summary: "" }}
              label="Visits"
              onChange={setVisits}
              render={(row, set) => (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Visit type"
                      onChange={(event) => set({ type: event.target.value })}
                      placeholder="Type"
                      value={row.type}
                    />
                    <DatePicker
                      ariaLabel="Visit date"
                      className="w-40 shrink-0"
                      onChange={(date) => set({ date })}
                      placeholder="Date"
                      value={row.date}
                    />
                  </div>
                  <Input
                    aria-label="Provider"
                    onChange={(event) => set({ provider: event.target.value })}
                    placeholder="Provider"
                    value={row.provider}
                  />
                  <Input
                    aria-label="Summary"
                    onChange={(event) => set({ summary: event.target.value })}
                    placeholder="Summary"
                    value={row.summary}
                  />
                </div>
              )}
              rows={visits}
            />
          </DialogPanel>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {error && (
              <p className="text-sm text-destructive sm:mr-auto">{error}</p>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!name.trim() || submitting} type="submit">
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Save patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
