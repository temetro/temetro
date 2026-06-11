"use client";

import { Check, FlaskConical, Plus, Search } from "lucide-react";
import {
  type FormEvent,
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
import {
  type LabFlag,
  type Patient,
  appendLabs,
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

const LAB_FLAGS: LabFlag[] = ["normal", "low", "high", "critical"];

// Patient dates are stored as formatted strings (e.g. "Jun 02, 2026") — match
// the format used by the patient form.
const today = () =>
  new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

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
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [flag, setFlag] = useState<LabFlag>("normal");
  const [takenAt, setTakenAt] = useState(today());
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPatient(null);
    setPatientQuery("");
    setName("");
    setValue("");
    setFlag("normal");
    setTakenAt(today());
    setSaving(false);
  };

  const search = patientQuery.trim().toLowerCase();
  const matches = useMemo(() => {
    const base = search
      ? patients.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.fileNumber.includes(search),
        )
      : patients;
    return base.slice(0, 6);
  }, [patients, search]);

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
    setSaving(true);
    try {
      await appendLabs(patient.fileNumber, [
        {
          name: name.trim(),
          value: value.trim(),
          flag,
          takenAt: takenAt.trim() || today(),
        },
      ]);
      notify.success(
        t("lab.addResult.addedTitle"),
        t("lab.addResult.addedBody", { test: name.trim(), name: patient.name }),
      );
      reset();
      onOpenChange(false);
      onAdded();
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
                  <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9"
                    onChange={(event) => setPatientQuery(event.target.value)}
                    placeholder={t("lab.addResult.patientPlaceholder")}
                    value={patientQuery}
                  />
                </div>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {matches.map((p) => (
                    <button
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                      key={p.fileNumber}
                      onClick={() => setPatient(p)}
                      type="button"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback>{p.initials}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-sm">{p.name}</span>
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
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("lab.addResult.test")}>
                <Input
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("lab.addResult.testPlaceholder")}
                  value={name}
                />
              </Field>
              <Field label={t("lab.addResult.value")}>
                <Input
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={t("lab.addResult.valuePlaceholder")}
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

// The lab department home: the lab's task queue plus the "add result" flow
// for submitting a patient's analyses to their record.
export function LabView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [addOpen, setAddOpen] = useState(false);

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
        if (active) setPatients(data);
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
              <div className="flex items-center gap-3 px-4 py-3" key={task.id}>
                <CheckButton
                  done={task.done}
                  label={
                    task.done ? t("tasks.markNotDone") : t("tasks.markDone")
                  }
                  onClick={() => toggle(task.id)}
                />
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
              </div>
            ))
          )}
        </div>
      </section>

      <AddResultDialog
        onAdded={() => {
          /* the patient record is reloaded on next lookup; nothing to refresh here */
        }}
        onOpenChange={setAddOpen}
        open={addOpen}
        patients={patients}
      />
    </div>
  );
}
