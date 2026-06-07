"use client";

import { Check, Plus } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type Priority,
  type Task,
  type TaskInput,
  createTask,
  listTasks,
  updateTask,
} from "@/lib/tasks";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type { Priority, Task } from "@/lib/tasks";

type Filter = "all" | "open" | "done";

const priorityVariant: Record<Priority, "destructive" | "secondary" | "outline"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

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

function AddTaskDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: TaskInput) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const reset = () => {
    setTitle("");
    setNotes("");
    setAssignee("");
    setDue("");
    setPriority("medium");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      notify.error(
        t("tasks.toast.needSubjectTitle"),
        t("tasks.toast.needSubjectBody"),
      );
      return;
    }
    onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || "Unassigned",
      due: due.trim() || "No due date",
      priority,
    });
    notify.success(t("tasks.toast.addedTitle"), title.trim());
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
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tasks.dialog.title")}</DialogTitle>
          <DialogDescription>{t("tasks.dialog.description")}</DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label={t("tasks.dialog.subject")}>
              <Input
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("tasks.dialog.subjectPlaceholder")}
                value={title}
              />
            </Field>
            <Field label={t("tasks.dialog.details")}>
              <Textarea
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("tasks.dialog.detailsPlaceholder")}
                rows={4}
                value={notes}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("tasks.dialog.assignee")}>
                <Input
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder={t("tasks.dialog.assigneePlaceholder")}
                  value={assignee}
                />
              </Field>
              <Field label={t("tasks.dialog.due")}>
                <Input
                  onChange={(e) => setDue(e.target.value)}
                  placeholder={t("tasks.dialog.duePlaceholder")}
                  value={due}
                />
              </Field>
            </div>
            <Field label={t("tasks.dialog.priorityLabel")}>
              <select
                className={controlClass}
                onChange={(e) => setPriority(e.target.value as Priority)}
                value={priority}
              >
                <option value="high">{t("tasks.priority.high")}</option>
                <option value="medium">{t("tasks.priority.medium")}</option>
                <option value="low">{t("tasks.priority.low")}</option>
              </select>
            </Field>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("tasks.dialog.cancel")}
            </DialogClose>
            <Button type="submit">{t("tasks.dialog.add")}</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function TasksView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
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
    return () => {
      active = false;
    };
  }, []);

  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  const visible = useMemo(() => {
    if (filter === "open") return tasks.filter((task) => !task.done);
    if (filter === "done") return tasks.filter((task) => task.done);
    return tasks;
  }, [tasks, filter]);

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
        t("tasks.toast.updateFailedTitle"),
        t("tasks.toast.updateFailedBody"),
      );
    }
  };

  const openTask = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const addTask = async (task: TaskInput) => {
    try {
      const created = await createTask(task);
      setTasks((prev) => [created, ...prev]);
    } catch {
      notify.error(
        t("tasks.toast.addFailedTitle"),
        t("tasks.toast.addFailedBody"),
      );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("tasks.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("tasks.subtitle")}</p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          {t("tasks.new")}
        </Button>
      </div>

      <div className="flex w-full items-center gap-1 rounded-2xl border bg-card/30 p-1 sm:w-fit">
        {(["all", "open", "done"] as Filter[]).map((f) => (
          <Button
            className="flex-1 sm:flex-none"
            key={f}
            onClick={() => setFilter(f)}
            size="sm"
            type="button"
            variant={filter === f ? "secondary" : "ghost"}
          >
            {t(`tasks.filters.${f}`)}
          </Button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            {t("tasks.empty")}
          </p>
        ) : (
          visible.map((task) => (
            <div className="flex items-center gap-3 px-4 py-3" key={task.id}>
              <CheckButton
                done={task.done}
                label={
                  task.done ? t("tasks.markNotDone") : t("tasks.markDone")
                }
                onClick={() => toggle(task.id)}
              />
              <button
                className="flex min-w-0 flex-1 flex-col text-left"
                onClick={() => openTask(task.id)}
                type="button"
              >
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
                  {task.assignee} · {task.due}
                </span>
              </button>
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

      <AddTaskDialog onAdd={addTask} onOpenChange={setAddOpen} open={addOpen} />

      <TaskDetailSheet
        onOpenChange={setSheetOpen}
        onToggle={toggle}
        open={sheetOpen}
        task={selected}
      />
    </div>
  );
}
