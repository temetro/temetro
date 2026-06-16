"use client";

import { AlertTriangle, CalendarPlus, Search, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

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
import { Textarea } from "@/components/ui/textarea";
import { type InventoryItem, listInventory } from "@/lib/inventory";
import { listPatients, type Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type NewPrescription = {
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  frequency: string;
  duration: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Every 8 hours",
  "As needed",
];

// Preset courses for the Duration dropdown; "Other" reveals a free-text input.
const DURATIONS = [
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "1 month",
  "3 months",
  "Ongoing",
  "Other",
];
const OTHER_DURATION = "Other";

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
// medication detail. The new entry is handed back to the page via onAdd, which
// persists it through the prescriptions API.
export function AddPrescriptionDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (rx: NewPrescription) => void;
}) {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [medication, setMedication] = useState("");
  const [medFocused, setMedFocused] = useState(false);
  const [medIndex, setMedIndex] = useState(0);
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [durationChoice, setDurationChoice] = useState(DURATIONS[0]);
  const [durationCustom, setDurationCustom] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // Load patients + inventory lazily when the dialog opens (for the quick
  // searches). Inventory backs the medication combobox; it still accepts free
  // text when there's no match (or no stock recorded yet).
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
    listInventory()
      .then((data) => {
        if (active) setInventory(data);
      })
      .catch(() => {
        /* no inventory → medication stays free text */
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

  // Inventory suggestions for the medication field: match by name/strength while
  // typing, but never block free text (no exact match required).
  const medMatches = useMemo(() => {
    const q = medication.trim().toLowerCase();
    if (!q) return [];
    return inventory
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          `${i.name} ${i.strength}`.toLowerCase().includes(q),
      )
      .filter((i) => `${i.name} ${i.strength}`.trim().toLowerCase() !== q)
      .slice(0, 6);
  }, [inventory, medication]);

  // Keep the highlighted option in range as the result lists change.
  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => setMedIndex(0), [medication]);

  const pickPatient = (p: Patient) => {
    setSelected(p);
    setQuery("");
  };

  const onPatientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = matches[activeIndex];
      if (match) pickPatient(match);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  };

  // Fill the medication (and dose, when the item carries a strength) from an
  // inventory suggestion.
  const pickMedication = (item: InventoryItem) => {
    setMedication([item.name, item.strength].filter(Boolean).join(" ").trim());
    if (item.strength && !dose.trim()) setDose(item.strength);
    setMedFocused(false);
  };

  const onMedKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (medMatches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMedIndex((i) => Math.min(i + 1, medMatches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Only intercept Enter when a suggestion is highlighted; otherwise let the
      // free-text value stand (and don't submit the form).
      const match = medMatches[medIndex];
      if (match) {
        event.preventDefault();
        pickMedication(match);
      }
    } else if (event.key === "Escape") {
      setMedFocused(false);
    }
  };

  const conflicts = useMemo(
    () => (selected ? findConflicts(medication, selected) : []),
    [medication, selected],
  );

  const reset = () => {
    setQuery("");
    setActiveIndex(0);
    setSelected(null);
    setMedication("");
    setMedFocused(false);
    setMedIndex(0);
    setDose("");
    setFrequency(FREQUENCIES[0]);
    setDurationChoice(DURATIONS[0]);
    setDurationCustom("");
    setShowDates(false);
    setStartDate("");
    setEndDate("");
    setNotes("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) {
      notify.error(
        t("prescriptions.dialog.pickPatientTitle"),
        t("prescriptions.dialog.pickPatientBody"),
      );
      return;
    }
    if (!medication.trim()) {
      notify.error(
        t("prescriptions.dialog.needMedTitle"),
        t("prescriptions.dialog.needMedBody"),
      );
      return;
    }
    const duration =
      durationChoice === OTHER_DURATION ? durationCustom.trim() : durationChoice;
    if (durationChoice === OTHER_DURATION && !duration) {
      notify.error(
        t("prescriptions.dialog.needDurationTitle"),
        t("prescriptions.dialog.needDurationBody"),
      );
      return;
    }
    // When both optional dates are set, the end must not precede the start.
    if (showDates && startDate && endDate && endDate < startDate) {
      notify.error(
        t("prescriptions.dialog.badDatesTitle"),
        t("prescriptions.dialog.badDatesBody"),
      );
      return;
    }
    onAdd({
      fileNumber: selected.fileNumber,
      name: selected.name,
      initials: selected.initials,
      medication: medication.trim(),
      dose: dose.trim(),
      frequency,
      duration,
      startDate: showDates ? startDate : "",
      endDate: showDates ? endDate : "",
      notes: notes.trim(),
    });
    notify.success(
      t("prescriptions.dialog.addedTitle"),
      `${medication.trim()} · ${selected.name}`,
    );
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
          <DialogTitle>{t("prescriptions.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("prescriptions.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label={t("prescriptions.dialog.patient")}>
              {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border bg-input/30 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {selected.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("prescriptions.dialog.fileNumber", {
                        number: selected.fileNumber,
                      })}
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
                    {t("prescriptions.dialog.change")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                    <Input
                      aria-autocomplete="list"
                      autoFocus
                      className="pl-9"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onPatientKeyDown}
                      placeholder={t("prescriptions.dialog.searchPlaceholder")}
                      value={query}
                    />
                  </div>
                  {query.trim() && (
                    <div className="max-h-56 overflow-y-auto rounded-2xl border bg-popover p-1">
                      {matches.length === 0 ? (
                        <p className="px-2 py-2 text-muted-foreground text-sm">
                          {t("prescriptions.dialog.noPatients")}
                        </p>
                      ) : (
                        matches.map((p, i) => (
                          <button
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                              i === activeIndex
                                ? "bg-accent"
                                : "hover:bg-accent",
                            )}
                            key={p.fileNumber}
                            onClick={() => pickPatient(p)}
                            onMouseEnter={() => setActiveIndex(i)}
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

            <Field label={t("prescriptions.dialog.medication")}>
              <div className="relative">
                <Input
                  aria-autocomplete="list"
                  onBlur={() => setTimeout(() => setMedFocused(false), 120)}
                  onChange={(event) => setMedication(event.target.value)}
                  onFocus={() => setMedFocused(true)}
                  onKeyDown={onMedKeyDown}
                  placeholder={t("prescriptions.dialog.medicationPlaceholder")}
                  value={medication}
                />
                {medFocused && medMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border bg-popover p-1 shadow-md">
                    {medMatches.map((item, i) => {
                      const out = item.stockQuantity <= 0;
                      return (
                        <button
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            i === medIndex ? "bg-accent" : "hover:bg-accent",
                          )}
                          // Use onMouseDown so the pick fires before the input's
                          // blur closes the list.
                          key={item.id}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            pickMedication(item);
                          }}
                          onMouseEnter={() => setMedIndex(i)}
                          type="button"
                        >
                          <span className="truncate text-foreground text-sm">
                            {[item.name, item.strength]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              out
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {out
                              ? t("prescriptions.dialog.outOfStock")
                              : t("prescriptions.dialog.inStock", {
                                  count: item.stockQuantity,
                                })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("prescriptions.dialog.dose")}>
                <Input
                  onChange={(event) => setDose(event.target.value)}
                  placeholder={t("prescriptions.dialog.dosePlaceholder")}
                  value={dose}
                />
              </Field>
              <Field label={t("prescriptions.dialog.frequency")}>
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

            <Field label={t("prescriptions.dialog.duration")}>
              <select
                className={controlClass}
                onChange={(event) => setDurationChoice(event.target.value)}
                value={durationChoice}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {durationChoice === OTHER_DURATION && (
                <Input
                  autoFocus
                  onChange={(event) => setDurationCustom(event.target.value)}
                  placeholder={t("prescriptions.dialog.durationOtherPlaceholder")}
                  value={durationCustom}
                />
              )}
            </Field>

            {/* Optional explicit course window. When set, the end date drives
                expiry on the pharmacy queue instead of parsing the duration. */}
            {showDates ? (
              <div className="flex flex-col gap-3 rounded-2xl border bg-input/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    {t("prescriptions.dialog.courseDates")}
                  </span>
                  <button
                    className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                    onClick={() => {
                      setShowDates(false);
                      setStartDate("");
                      setEndDate("");
                    }}
                    type="button"
                  >
                    <X className="size-3.5" />
                    {t("prescriptions.dialog.removeDates")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("prescriptions.dialog.startDate")}>
                    <input
                      className={controlClass}
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                  </Field>
                  <Field label={t("prescriptions.dialog.endDate")}>
                    <input
                      className={controlClass}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      type="date"
                      value={endDate}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Button
                className="self-start"
                onClick={() => setShowDates(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <CalendarPlus className="size-4" />
                {t("prescriptions.dialog.addDates")}
              </Button>
            )}

            <Field label={t("prescriptions.dialog.notes")}>
              <Textarea
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("prescriptions.dialog.notesPlaceholder")}
                rows={3}
                value={notes}
              />
            </Field>

            {conflicts.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>
                  {t("prescriptions.dialog.interactionTitle")}
                </AlertTitle>
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
              {t("prescriptions.dialog.cancel")}
            </DialogClose>
            <Button disabled={!selected} type="submit">
              {t("prescriptions.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
