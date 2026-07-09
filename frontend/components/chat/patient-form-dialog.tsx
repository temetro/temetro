"use client";

import { CalendarIcon, Plus, RefreshCw, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StagedFilesField } from "@/components/patients/patient-files";
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
import { ROLE_LABELS } from "@/lib/access";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  type AllergySeverity,
  createPatient,
  generateFileNumber,
  type LabFlag,
  type Patient,
  updatePatient,
} from "@/lib/patients";
import { uploadAttachment } from "@/lib/attachments";
import { hasClinicalAccess, useActiveRole } from "@/lib/roles";
import { listProviders, type Provider } from "@/lib/staff";
import { notify } from "@/lib/toast";
import { useWalletSync } from "@/components/wallet/use-wallet-sync";
import {
  DialogStepper,
  WalletSyncStep,
} from "@/components/wallet/wallet-sync-step";

type PatientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  patient?: Patient;
  onCreated?: (fileNumber: string) => void;
  onSaved?: (patient: Patient) => void;
  // Review mode: when provided, the form does NOT persist — it emits the edited
  // record so a caller (e.g. the import review dialog) can stage it. The file
  // number becomes editable so a clinician can fix an import row.
  onDraft?: (record: Patient) => void;
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
  const { t } = useTranslation();
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
          {t("patientForm.add")}
        </Button>
      </div>
      {rows.map((row, index) => (
        <div className="flex items-center gap-2" key={index}>
          {render(row, (patch) =>
            onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
          )}
          <button
            aria-label={t("patientForm.removeRow", { label })}
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
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const placeholderText = placeholder ?? t("patientForm.pickDate");

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
        <span className="truncate">{value || placeholderText}</span>
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
  onDraft,
}: PatientFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";
  // Review mode stages an edited record instead of writing it (import flow).
  const isReview = Boolean(onDraft);
  // Reception registers demographics only — clinical sections are hidden (the
  // backend also redacts/ignores clinical data for this role). Show everything
  // while the role is still loading to avoid a flash for clinical users.
  const role = useActiveRole();
  const showClinical = role == null || hasClinicalAccess(role);
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Files staged in the form, uploaded once the patient record is saved (so the
  // attachment can be linked to the file number).
  const [files, setFiles] = useState<File[]>([]);

  const [fileNumber, setFileNumber] = useState(() =>
    isEdit && patient ? patient.fileNumber : generateFileNumber()
  );
  const [step, setStep] = useState<"form" | "wallet">("form");

  // Only edits to an existing (non-review) record can sync to a wallet — a newly
  // created patient has no wallet, and review mode stages an import.
  const sync = useWalletSync(isEdit && !isReview ? fileNumber : null);

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStep("form");
      sync.reset();
    }
  };
  const [name, setName] = useState(patient?.name ?? "");
  const [age, setAge] = useState(patient ? String(patient.age) : "");
  const [sex, setSex] = useState<Patient["sex"]>(patient?.sex ?? "F");
  const [status, setStatus] = useState<Patient["status"]>(
    patient?.status ?? "active"
  );
  // Primary care provider is picked from the clinic's clinicians (drives
  // per-doctor visibility), not free text. `providerId` is the selected user id.
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState(patient?.primaryProviderId ?? "");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [bloodType, setBloodType] = useState(patient?.bloodType ?? "");
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

  // Load the clinic's clinicians for the PCP picker. When creating, default the
  // PCP to the current user if they're a provider (a doctor registering their
  // own patient).
  useEffect(() => {
    let active = true;
    listProviders()
      .then((list) => {
        if (!active) return;
        setProviders(list);
        if (!isEdit && myId && list.some((p) => p.userId === myId)) {
          setProviderId((cur) => cur || myId);
        }
      })
      .catch(() => {
        /* leave the picker empty; PCP just stays unassigned */
      });
    return () => {
      active = false;
    };
  }, [isEdit, myId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || submitting) {
      return;
    }

    const selectedProvider = providers.find((p) => p.userId === providerId);
    // Display name follows the selected provider; preserve any existing label
    // when nothing is selected so legacy free-text PCPs aren't wiped on edit.
    const pcpName = selectedProvider?.name ?? (patient?.pcp || "—");

    const built: Patient = {
      fileNumber,
      name: name.trim(),
      age: Number(age) || 0,
      sex,
      pcp: pcpName,
      primaryProviderId: providerId || null,
      status,
      initials: initialsFromName(name),
      phone: phone.trim(),
      bloodType,
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

    // Review mode: hand the edited record back to the caller, don't persist.
    if (onDraft) {
      onDraft(built);
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const saved = isEdit
        ? await updatePatient(built)
        : await createPatient(built);
      // Upload any staged files now that we have a saved file number.
      if (files.length > 0) {
        const results = await Promise.allSettled(
          files.map((file) =>
            uploadAttachment({ file, fileNumber: saved.fileNumber }),
          ),
        );
        if (results.some((r) => r.status === "rejected")) {
          notify.error(
            t("patientFiles.uploadFailedTitle"),
            t("patientFiles.uploadFailedBody"),
          );
        }
        setFiles([]);
      }
      if (isEdit) {
        onSaved?.(saved);
        notify.success(
          t("patientForm.updatedTitle"),
          t("patientForm.updatedBody", { name: saved.name }),
        );
        if (sync.linked) {
          setStep("wallet");
          return;
        }
      } else {
        onCreated?.(saved.fileNumber);
        notify.success(
          t("patientForm.addedTitle"),
          t("patientForm.addedBody", {
            name: saved.name,
            fileNumber: saved.fileNumber,
          }),
        );
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("patientForm.saveError");
      setError(message);
      notify.error(t("patientForm.saveFailedTitle"), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isReview
              ? t("patientForm.reviewTitle")
              : isEdit
                ? t("patientForm.editTitle")
                : t("patientForm.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isReview
              ? t("patientForm.reviewDescription")
              : isEdit
                ? t("patientForm.editDescription", {
                    name: patient?.name ?? "this",
                  })
                : t("patientForm.createDescription")}
          </DialogDescription>
          {sync.linked && <DialogStepper step={step} />}
        </DialogHeader>

        {step === "wallet" ? (
          <WalletSyncStep
            onDone={() => handleOpenChange(false)}
            patientName={name.trim()}
            summary={t("walletSync.summary.demographics")}
            sync={sync}
          />
        ) : (
        <form className="contents" onSubmit={handleSubmit}>
          <DialogPanel
            scrollFade={false}
            className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
          >
            <Field label={t("patientForm.fileNumber")}>
              <div className="flex items-center gap-2">
                <Input
                  onChange={
                    isReview
                      ? (event) =>
                          setFileNumber(event.target.value.replace(/\D/g, ""))
                      : undefined
                  }
                  readOnly={!isReview}
                  value={fileNumber}
                />
                {!isEdit && !isReview && (
                  <Button
                    aria-label={t("patientForm.regenerate")}
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

            <Field label={t("patientForm.fullName")}>
              <Input
                autoFocus={!isEdit}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("patientForm.fullNamePlaceholder")}
                required
                value={name}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label={t("patientForm.age")}>
                <Input
                  inputMode="numeric"
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="—"
                  value={age}
                />
              </Field>
              <Field label={t("patientForm.sex")}>
                <select
                  className={controlClass}
                  onChange={(event) =>
                    setSex(event.target.value as Patient["sex"])
                  }
                  value={sex}
                >
                  <option value="F">{t("patientCard.sex.F")}</option>
                  <option value="M">{t("patientCard.sex.M")}</option>
                </select>
              </Field>
              <Field label={t("patientForm.status")}>
                <select
                  className={controlClass}
                  onChange={(event) =>
                    setStatus(event.target.value as Patient["status"])
                  }
                  value={status}
                >
                  <option value="active">{t("patients.status.active")}</option>
                  <option value="inpatient">
                    {t("patients.status.inpatient")}
                  </option>
                  <option value="discharged">
                    {t("patients.status.discharged")}
                  </option>
                </select>
              </Field>
            </div>

            <Field label={t("patientForm.primaryCare")}>
              <select
                className={controlClass}
                onChange={(event) => setProviderId(event.target.value)}
                value={providerId}
              >
                <option value="">
                  {t("patientForm.primaryCareUnassigned")}
                </option>
                {providers.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name} · {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("patientForm.phone")}>
                <Input
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t("patientForm.phonePlaceholder")}
                  value={phone}
                />
              </Field>
              <Field label={t("patientForm.bloodType")}>
                <select
                  className={controlClass}
                  onChange={(event) => setBloodType(event.target.value)}
                  value={bloodType}
                >
                  <option value="">{t("patientForm.bloodTypeUnknown")}</option>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {showClinical && (
              <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("patientForm.currentVitals")}
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input
                  aria-label={t("patientForm.bp")}
                  onChange={(event) => setBp(event.target.value)}
                  placeholder={t("patientCard.vitals.bp")}
                  value={bp}
                />
                <Input
                  aria-label={t("patientForm.hr")}
                  onChange={(event) => setHr(event.target.value)}
                  placeholder={t("patientCard.vitals.hr")}
                  value={hr}
                />
                <Input
                  aria-label={t("patientForm.temp")}
                  onChange={(event) => setTemp(event.target.value)}
                  placeholder={t("patientCard.vitals.temp")}
                  value={temp}
                />
                <Input
                  aria-label={t("patientForm.spo2")}
                  onChange={(event) => setSpo2(event.target.value)}
                  placeholder={t("patientCard.vitals.spo2")}
                  value={spo2}
                />
              </div>
            </div>

            <SectionList<AllergyDraft>
              blank={{ substance: "", reaction: "", severity: "mild" }}
              label={t("patientForm.allergies")}
              onChange={setAllergies}
              render={(row, set) => (
                <>
                  <Input
                    aria-label={t("patientForm.substance")}
                    onChange={(event) => set({ substance: event.target.value })}
                    placeholder={t("patientForm.substance")}
                    value={row.substance}
                  />
                  <Input
                    aria-label={t("patientForm.reaction")}
                    onChange={(event) => set({ reaction: event.target.value })}
                    placeholder={t("patientForm.reaction")}
                    value={row.reaction}
                  />
                  <select
                    aria-label={t("patientForm.severityAria")}
                    className={cn(controlClass, "w-auto")}
                    onChange={(event) =>
                      set({ severity: event.target.value as AllergySeverity })
                    }
                    value={row.severity}
                  >
                    <option value="mild">{t("patientCard.severity.mild")}</option>
                    <option value="moderate">
                      {t("patientCard.severity.moderate")}
                    </option>
                    <option value="severe">
                      {t("patientCard.severity.severe")}
                    </option>
                  </select>
                </>
              )}
              rows={allergies}
            />

            <SectionList<MedicationDraft>
              blank={{ name: "", dose: "", frequency: "" }}
              label={t("patientForm.medications")}
              onChange={setMedications}
              render={(row, set) => (
                <>
                  <Input
                    aria-label={t("patientForm.medNameAria")}
                    onChange={(event) => set({ name: event.target.value })}
                    placeholder={t("patientForm.medName")}
                    value={row.name}
                  />
                  <Input
                    aria-label={t("patientForm.dose")}
                    onChange={(event) => set({ dose: event.target.value })}
                    placeholder={t("patientForm.dose")}
                    value={row.dose}
                  />
                  <Input
                    aria-label={t("patientForm.frequency")}
                    onChange={(event) => set({ frequency: event.target.value })}
                    placeholder={t("patientForm.frequency")}
                    value={row.frequency}
                  />
                </>
              )}
              rows={medications}
            />

            <SectionList<ProblemDraft>
              blank={{ label: "", since: "" }}
              label={t("patientForm.problems")}
              onChange={setProblems}
              render={(row, set) => (
                <>
                  <Input
                    aria-label={t("patientForm.problemAria")}
                    onChange={(event) => set({ label: event.target.value })}
                    placeholder={t("patientForm.diagnosis")}
                    value={row.label}
                  />
                  <DatePicker
                    ariaLabel={t("patientForm.sinceAria")}
                    className="w-40 shrink-0"
                    onChange={(since) => set({ since })}
                    placeholder={t("patientForm.sinceAria")}
                    value={row.since}
                  />
                </>
              )}
              rows={problems}
            />

            <SectionList<LabDraft>
              blank={{ name: "", value: "", flag: "normal", takenAt: "" }}
              label={t("patientForm.labs")}
              onChange={setLabs}
              render={(row, set) => (
                <>
                  <Input
                    aria-label={t("patientForm.labNameAria")}
                    onChange={(event) => set({ name: event.target.value })}
                    placeholder={t("patientForm.test")}
                    value={row.name}
                  />
                  <Input
                    aria-label={t("patientForm.valueAria")}
                    onChange={(event) => set({ value: event.target.value })}
                    placeholder={t("patientForm.value")}
                    value={row.value}
                  />
                  <select
                    aria-label={t("patientForm.flagAria")}
                    className={cn(controlClass, "w-auto")}
                    onChange={(event) => set({ flag: event.target.value as LabFlag })}
                    value={row.flag}
                  >
                    <option value="normal">
                      {t("patientCard.labFlag.normal")}
                    </option>
                    <option value="low">{t("patientCard.labFlag.low")}</option>
                    <option value="high">{t("patientCard.labFlag.high")}</option>
                    <option value="critical">
                      {t("patientCard.labFlag.critical")}
                    </option>
                  </select>
                </>
              )}
              rows={labs}
            />

            <SectionList<VisitDraft>
              blank={{ type: "", date: "", provider: "", summary: "" }}
              label={t("patientForm.visits")}
              onChange={setVisits}
              render={(row, set) => (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={t("patientForm.visitTypeAria")}
                      onChange={(event) => set({ type: event.target.value })}
                      placeholder={t("patientForm.visitType")}
                      value={row.type}
                    />
                    <DatePicker
                      ariaLabel={t("patientForm.visitDateAria")}
                      className="w-40 shrink-0"
                      onChange={(date) => set({ date })}
                      placeholder={t("patientForm.visitDate")}
                      value={row.date}
                    />
                  </div>
                  <Input
                    aria-label={t("patientForm.providerAria")}
                    onChange={(event) => set({ provider: event.target.value })}
                    placeholder={t("patientForm.provider")}
                    value={row.provider}
                  />
                  <Input
                    aria-label={t("patientForm.summaryAria")}
                    onChange={(event) => set({ summary: event.target.value })}
                    placeholder={t("patientForm.summary")}
                    value={row.summary}
                  />
                </div>
              )}
              rows={visits}
            />
              </>
            )}

            <StagedFilesField onChange={setFiles} value={files} />
          </DialogPanel>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {error && (
              <p className="text-sm text-destructive sm:me-auto">{error}</p>
            )}
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("patientForm.cancel")}
            </DialogClose>
            <Button disabled={!name.trim() || submitting} type="submit">
              {submitting
                ? t("patientForm.saving")
                : isReview
                  ? t("patientForm.saveDraft")
                  : isEdit
                    ? t("patientForm.saveChanges")
                    : t("patientForm.savePatient")}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
