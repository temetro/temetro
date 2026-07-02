"use client";

import {
  Check,
  ChevronDown,
  FlaskConical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { LabIntegrationCard } from "@/components/lab/lab-integration-card";
import { StagedFilesField } from "@/components/patients/patient-files";
import { uploadAttachment } from "@/lib/attachments";
import { LAB_ANALYSES, LAB_ANALYSIS_UNITS } from "@/lib/lab-analyses";
import {
  type Lab,
  type LabFlag,
  type Patient,
  appendLabs,
  deleteLab,
  listPatients,
} from "@/lib/patients";
import { type Priority, type Task, listTasks, updateTask } from "@/lib/tasks";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

const priorityVariant: Record<Priority, "destructive" | "secondary" | "outline"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

const flagVariant: Record<LabFlag, "secondary" | "warning" | "destructive"> = {
  normal: "secondary",
  low: "warning",
  high: "warning",
  critical: "destructive",
};

const LAB_FLAGS: LabFlag[] = ["normal", "low", "high", "critical"];

// A patient + one of their lab results, used by the "Recent results" feed.
type RecentResult = { patient: Patient; lab: Lab };

// Patient dates are stored as formatted strings (e.g. "Jun 02, 2026") — match
// the format used by the patient form.
const today = () =>
  new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

// Parse a stored date string to a timestamp for sorting; unknown formats sort
// last (0).
const ts = (s: string): number => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
};

// Flatten every patient's labs into a recent-results feed, newest first.
function buildRecent(patients: Patient[]): RecentResult[] {
  const all: RecentResult[] = [];
  for (const patient of patients) {
    for (const lab of patient.labs) all.push({ patient, lab });
  }
  all.sort((a, b) => ts(b.lab.takenAt) - ts(a.lab.takenAt));
  return all.slice(0, 12);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function CheckButton({
  done,
  onClick,
  label,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={done}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input hover:border-ring",
      )}
      onClick={onClick}
      type="button"
    >
      {done && <Check className="size-3.5" />}
    </button>
  );
}

// One labelled field in a work-queue item's expanded detail.
function QueueMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-foreground text-sm">{value}</dd>
    </div>
  );
}

// Dialog for submitting an analysis result: pick a patient, then enter the
// test name, value, flag and date. Posts to the lab-only append endpoint.
function AddResultDialog({
  open,
  onOpenChange,
  patients,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  onAdded: (patient: Patient, lab: Lab) => void;
}) {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  // Highlighted index in the patient match list, for arrow-key navigation.
  const [activeIndex, setActiveIndex] = useState(0);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [flag, setFlag] = useState<LabFlag>("normal");
  const [takenAt, setTakenAt] = useState(today());
  // Advanced mode reveals a free-form reference-range field for analyses that
  // aren't in the catalog (the test field already accepts any text).
  const [advanced, setAdvanced] = useState(false);
  const [refRange, setRefRange] = useState("");
  const [saving, setSaving] = useState(false);
  // Analysis files (PDF/image) attached to this result.
  const [files, setFiles] = useState<File[]>([]);

  const reset = () => {
    setPatient(null);
    setPatientQuery("");
    setActiveIndex(0);
    setName("");
    setValue("");
    setFlag("normal");
    setTakenAt(today());
    setAdvanced(false);
    setRefRange("");
    setFiles([]);
    setSaving(false);
  };

  const search = patientQuery.trim().toLowerCase();
  // Only surface patients once the user has typed something — never the full
  // roster on an empty field.
  const matches = useMemo(() => {
    if (!search) return [];
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.fileNumber.includes(search),
      )
      .slice(0, 6);
  }, [patients, search]);

  // Keyboard navigation for the patient list: ↑/↓ to move, Enter to select.
  const onPatientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Don't submit the form — pick the highlighted patient instead.
      event.preventDefault();
      const picked = matches[activeIndex];
      if (picked) setPatient(picked);
    }
  };

  // Unit hint for the value field once a catalogued analysis is chosen.
  const unitHint = LAB_ANALYSIS_UNITS[name.trim()];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!patient) {
      notify.error(
        t("lab.addResult.needPatientTitle"),
        t("lab.addResult.needPatientBody"),
      );
      return;
    }
    if (!name.trim() || !value.trim()) {
      notify.error(
        t("lab.addResult.needFieldsTitle"),
        t("lab.addResult.needFieldsBody"),
      );
      return;
    }
    const finalValue =
      advanced && refRange.trim()
        ? `${value.trim()} (ref ${refRange.trim()})`
        : value.trim();
    const lab: Lab = {
      name: name.trim(),
      value: finalValue,
      flag,
      takenAt: takenAt.trim() || today(),
    };
    setSaving(true);
    try {
      await appendLabs(patient.fileNumber, [lab]);
      // Attach any analysis files to this result (best-effort).
      if (files.length > 0) {
        const labKey = `${lab.name} · ${lab.takenAt}`;
        const results = await Promise.allSettled(
          files.map((file) =>
            uploadAttachment({
              file,
              fileNumber: patient.fileNumber,
              labKey,
            }),
          ),
        );
        if (results.some((r) => r.status === "rejected")) {
          notify.error(
            t("patientFiles.uploadFailedTitle"),
            t("patientFiles.uploadFailedBody"),
          );
        }
      }
      notify.success(
        t("lab.addResult.addedTitle"),
        t("lab.addResult.addedBody", { test: lab.name, name: patient.name }),
      );
      const added = patient;
      reset();
      onOpenChange(false);
      onAdded(added, lab);
    } catch {
      setSaving(false);
      notify.error(
        t("lab.addResult.failedTitle"),
        t("lab.addResult.failedBody"),
      );
    }
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      open={open}
    >
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("lab.addResult.title")}</DialogTitle>
          <DialogDescription>{t("lab.addResult.description")}</DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            {patient ? (
              <div className="flex items-center gap-3 rounded-2xl border bg-card/30 px-3 py-2">
                <Avatar className="size-8">
                  <AvatarFallback>{patient.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {patient.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    #{patient.fileNumber}
                  </span>
                </div>
                <Button
                  onClick={() => setPatient(null)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("lab.addResult.changePatient")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {t("lab.addResult.patient")}
                </span>
                <div className="relative">
                  <Search className="-translate-y-1/2 absolute top-1/2 start-3 size-4 text-muted-foreground" />
                  <Input
                    aria-activedescendant={
                      matches[activeIndex]
                        ? `patient-opt-${matches[activeIndex].fileNumber}`
                        : undefined
                    }
                    autoFocus
                    className="ps-9"
                    onChange={(event) => {
                      setPatientQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onPatientKeyDown}
                    placeholder={t("lab.addResult.patientPlaceholder")}
                    value={patientQuery}
                  />
                </div>
                {search.length > 0 && (
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {matches.map((p, index) => (
                      <button
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors",
                          index === activeIndex
                            ? "bg-accent"
                            : "hover:bg-accent",
                        )}
                        id={`patient-opt-${p.fileNumber}`}
                        key={p.fileNumber}
                        onClick={() => setPatient(p)}
                        onMouseMove={() => setActiveIndex(index)}
                        type="button"
                      >
                        <Avatar className="size-8">
                          <AvatarFallback>{p.initials}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate text-sm">
                          {p.name}
                        </span>
                        <span className="ms-auto text-muted-foreground text-xs">
                          #{p.fileNumber}
                        </span>
                      </button>
                    ))}
                    {matches.length === 0 && (
                      <p className="px-2 py-3 text-muted-foreground text-sm">
                        {t("lab.addResult.noPatients")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("lab.addResult.test")}>
                <Input
                  list="lab-analyses-list"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("lab.addResult.testPlaceholder")}
                  value={name}
                />
                <datalist id="lab-analyses-list">
                  {LAB_ANALYSES.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.group}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label={t("lab.addResult.value")}>
                <Input
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={
                    unitHint
                      ? t("lab.addResult.valueUnitPlaceholder", {
                          unit: unitHint,
                        })
                      : t("lab.addResult.valuePlaceholder")
                  }
                  value={value}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("lab.addResult.flag")}>
                <select
                  className={controlClass}
                  onChange={(event) => setFlag(event.target.value as LabFlag)}
                  value={flag}
                >
                  {LAB_FLAGS.map((f) => (
                    <option key={f} value={f}>
                      {t(`patientCard.labFlag.${f}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("lab.addResult.takenAt")}>
                <Input
                  onChange={(event) => setTakenAt(event.target.value)}
                  value={takenAt}
                />
              </Field>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border bg-card/30 px-3 py-2">
              <span className="flex flex-col">
                <span className="font-medium text-foreground text-sm">
                  {t("lab.addResult.advanced")}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t("lab.addResult.advancedHint")}
                </span>
              </span>
              <Switch checked={advanced} onCheckedChange={setAdvanced} />
            </label>

            {advanced && (
              <Field label={t("lab.addResult.refRange")}>
                <Input
                  onChange={(event) => setRefRange(event.target.value)}
                  placeholder={t("lab.addResult.refRangePlaceholder")}
                  value={refRange}
                />
              </Field>
            )}

            <StagedFilesField
              label={t("lab.addResult.files")}
              onChange={setFiles}
              value={files}
            />
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("lab.addResult.cancel")}
            </DialogClose>
            <Button disabled={saving} type="submit">
              {t("lab.addResult.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

// The lab department home: the lab's task queue, an "add result" flow for
// submitting a patient's analyses, and a feed of recently recorded results.
export function LabView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<RecentResult[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  // The result staged for deletion (drives the confirm dialog).
  const [toDelete, setToDelete] = useState<RecentResult | null>(null);

  useEffect(() => {
    let active = true;
    listTasks()
      .then((data) => {
        if (active) setTasks(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the list empty */
      });
    listPatients()
      .then((data) => {
        if (active) {
          setPatients(data);
          setRecent(buildRecent(data));
        }
      })
      .catch(() => {
        /* same */
      });
    return () => {
      active = false;
    };
  }, []);

  // The lab work queue. The backend already scopes visibility; the client
  // filter keeps the page focused for admins (who see every task).
  const queue = useMemo(
    () => tasks.filter((task) => task.assigneeRole === "lab"),
    [tasks],
  );

  // After a result is submitted: show it instantly at the top of the feed, and
  // refresh patient records in the background so it survives a reload.
  const handleAdded = (patient: Patient, lab: Lab) => {
    setRecent((prev) => [{ patient, lab }, ...prev].slice(0, 12));
    listPatients()
      .then((data) => setPatients(data))
      .catch(() => {
        /* keep the optimistic feed if the refresh fails */
      });
  };

  // Remove a result from the feed + the patient's record.
  const confirmDelete = async () => {
    if (!toDelete) return;
    const { patient, lab } = toDelete;
    try {
      await deleteLab(patient.fileNumber, lab);
      setRecent((prev) =>
        prev.filter(
          (r) =>
            !(
              r.patient.fileNumber === patient.fileNumber &&
              r.lab.name === lab.name &&
              r.lab.value === lab.value &&
              r.lab.takenAt === lab.takenAt
            ),
        ),
      );
      notify.success(
        t("lab.recent.deletedTitle"),
        t("lab.recent.deletedBody", { test: lab.name, name: patient.name }),
      );
    } catch {
      notify.error(
        t("lab.recent.deleteFailedTitle"),
        t("lab.recent.deleteFailedBody"),
      );
    } finally {
      setToDelete(null);
    }
  };

  // Optimistically flip done, then persist; roll back on failure.
  const toggle = async (id: string) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    const next = !current.done;
    setTasks((prev) =>
      prev.map((row) => (row.id === id ? { ...row, done: next } : row)),
    );
    try {
      await updateTask(id, { done: next });
    } catch {
      setTasks((prev) =>
        prev.map((row) => (row.id === id ? { ...row, done: current.done } : row)),
      );
      notify.error(
        t("lab.toast.updateFailedTitle"),
        t("lab.toast.updateFailedBody"),
      );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("lab.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("lab.subtitle")}</p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          {t("lab.addResult.button")}
        </Button>
      </div>

      <LabIntegrationCard
        onSynced={() =>
          listPatients()
            .then((data) => {
              setPatients(data);
              setRecent(buildRecent(data));
            })
            .catch(() => {})
        }
        patients={patients}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("lab.queue.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("lab.queue.description")}
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <FlaskConical className="size-5 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                {t("lab.queue.empty")}
              </p>
            </div>
          ) : (
            queue.map((task) => (
              <Collapsible key={task.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckButton
                    done={task.done}
                    label={
                      task.done ? t("tasks.markNotDone") : t("tasks.markDone")
                    }
                    onClick={() => toggle(task.id)}
                  />
                  <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-3 text-start">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "truncate text-sm",
                          task.done
                            ? "text-muted-foreground line-through"
                            : "font-medium text-foreground",
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="truncate text-muted-foreground text-xs">
                        {task.due}
                        {task.createdByName
                          ? ` · ${t("tasks.list.byCreator", { name: task.createdByName })}`
                          : ""}
                      </span>
                    </div>
                    <Badge
                      className="shrink-0"
                      variant={priorityVariant[task.priority]}
                    >
                      {t(`tasks.priority.${task.priority}`)}
                    </Badge>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="space-y-3 px-4 pb-4 ps-12 text-sm">
                    <p
                      className={cn(
                        "whitespace-pre-wrap",
                        task.notes
                          ? "text-foreground"
                          : "text-muted-foreground italic",
                      )}
                    >
                      {task.notes || t("lab.queue.noNotes")}
                    </p>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      <QueueMeta
                        label={t("lab.queue.meta.status")}
                        value={t(`tasks.status.${task.status}`)}
                      />
                      <QueueMeta
                        label={t("lab.queue.meta.patient")}
                        value={task.patient || "—"}
                      />
                      <QueueMeta
                        label={t("lab.queue.meta.assignee")}
                        value={task.assignee || task.assigneeRole || "—"}
                      />
                      <QueueMeta
                        label={t("lab.queue.meta.createdBy")}
                        value={task.createdByName || "—"}
                      />
                    </dl>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("lab.recent.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("lab.recent.description")}
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {recent.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground text-sm">
              {t("lab.recent.empty")}
            </p>
          ) : (
            recent.map(({ patient, lab }, index) => (
              <div
                className="flex items-center gap-3 px-4 py-3"
                key={`${patient.fileNumber}-${lab.name}-${lab.takenAt}-${index}`}
              >
                <Avatar className="size-8">
                  <AvatarFallback>{patient.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {lab.name}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {lab.value}
                    </span>
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {patient.name} · #{patient.fileNumber} · {lab.takenAt}
                  </span>
                </div>
                <Badge className="shrink-0" variant={flagVariant[lab.flag]}>
                  {t(`patientCard.labFlag.${lab.flag}`)}
                </Badge>
                <button
                  aria-label={t("lab.recent.delete")}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive-foreground"
                  onClick={() => setToDelete({ patient, lab })}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <AddResultDialog
        onAdded={handleAdded}
        onOpenChange={setAddOpen}
        open={addOpen}
        patients={patients}
      />

      <ConfirmDialog
        cancelLabel={t("lab.recent.deleteCancel")}
        confirmLabel={t("lab.recent.deleteConfirm")}
        description={
          toDelete
            ? t("lab.recent.deleteBody", {
                test: toDelete.lab.name,
                name: toDelete.patient.name,
              })
            : undefined
        }
        onConfirm={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        open={toDelete !== null}
        title={t("lab.recent.deleteTitle")}
      />
    </div>
  );
}
