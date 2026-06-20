"use client";

import { CalendarClock, Plus } from "lucide-react";
import {
  type DragEvent,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS } from "@/lib/access";
import { DEPARTMENTS } from "@/lib/roles";
import { listProviders, type Provider, specialtyLabel } from "@/lib/staff";
import {
  type Priority,
  type Task,
  type TaskInput,
  type TaskStatus,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from "@/lib/tasks";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AssigneeMode = "self" | "department" | "person";

function deptLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

export type { Priority, Task } from "@/lib/tasks";

// The board columns, left → right.
const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

const priorityVariant: Record<Priority, "destructive" | "secondary" | "outline"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

// A subtle accent dot per column so the three are quick to tell apart.
const columnDot: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-primary",
  done: "bg-success",
};

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
  initialStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: TaskInput) => void;
  initialStatus: TaskStatus;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeMode, setAssigneeMode] = useState<AssigneeMode>("self");
  const [department, setDepartment] = useState<string>("reception");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);

  // Re-seed the column when the dialog is opened from a specific column, and
  // load the clinic's providers so a task can be assigned to a specific person.
  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus);
    listProviders()
      .then((list) => {
        setProviders(list);
        setProviderId((id) => id || (list[0]?.userId ?? ""));
      })
      .catch(() => setProviders([]));
  }, [open, initialStatus]);

  const reset = () => {
    setTitle("");
    setNotes("");
    setAssigneeMode("self");
    setDepartment("reception");
    setProviderId("");
    setDue("");
    setPriority("medium");
    setStatus(initialStatus);
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
    if (assigneeMode === "person" && !providerId) {
      notify.error(
        t("tasks.toast.needPersonTitle"),
        t("tasks.toast.needPersonBody"),
      );
      return;
    }
    const person =
      assigneeMode === "person"
        ? providers.find((p) => p.userId === providerId)
        : undefined;
    onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      // Myself → personal task; Department → a member role; Person → a specific
      // clinician (their name shows as the assignee, the task surfaces for them).
      assigneeRole: assigneeMode === "department" ? department : null,
      assigneeUserId: assigneeMode === "person" ? providerId || null : null,
      assignee: person?.name,
      due: due.trim() || "No due date",
      priority,
      status,
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
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">
                {t("tasks.dialog.assignee")}
              </span>
              <Tabs
                onValueChange={(value) =>
                  setAssigneeMode(value as AssigneeMode)
                }
                value={assigneeMode}
              >
                <TabsList className="w-full">
                  <TabsTab value="self">{t("tasks.dialog.assigneeSelf")}</TabsTab>
                  <TabsTab value="department">
                    {t("tasks.dialog.assigneeDepartment")}
                  </TabsTab>
                  <TabsTab value="person">
                    {t("tasks.dialog.assigneePerson")}
                  </TabsTab>
                </TabsList>
                <TabsPanel className="pt-2" value="department">
                  <Field label={t("tasks.dialog.department")}>
                    <select
                      className={controlClass}
                      onChange={(e) => setDepartment(e.target.value)}
                      value={department}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {ROLE_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </TabsPanel>
                <TabsPanel className="pt-2" value="person">
                  <Field label={t("tasks.dialog.person")}>
                    {providers.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("tasks.dialog.personEmpty")}
                      </p>
                    ) : (
                      <select
                        className={controlClass}
                        onChange={(e) => setProviderId(e.target.value)}
                        value={providerId}
                      >
                        {providers.map((p) => {
                          const spec = specialtyLabel(t, p.specialty);
                          return (
                            <option key={p.userId} value={p.userId}>
                              {spec ? `${p.name} · ${spec}` : p.name}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </Field>
                </TabsPanel>
              </Tabs>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("tasks.dialog.due")}>
                <Input
                  onChange={(e) => setDue(e.target.value)}
                  placeholder={t("tasks.dialog.duePlaceholder")}
                  value={due}
                />
              </Field>
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
              <Field label={t("tasks.dialog.statusLabel")}>
                <select
                  className={controlClass}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  value={status}
                >
                  {COLUMNS.map((s) => (
                    <option key={s} value={s}>
                      {t(`tasks.status.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
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

// One draggable task card on the board.
function TaskCard({
  task,
  onOpen,
  onDragStart,
}: {
  task: Task;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="group flex cursor-pointer flex-col gap-2 rounded-2xl border bg-card p-3 transition-colors hover:border-ring"
      draggable
      onClick={onOpen}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
    >
      <span
        className={cn(
          "text-sm",
          task.done
            ? "text-muted-foreground line-through"
            : "font-medium text-foreground",
        )}
      >
        {task.title}
      </span>
      <span className="truncate text-muted-foreground text-xs">
        {task.assigneeUserId
          ? t("tasks.list.forPerson", { name: task.assignee })
          : task.assigneeRole
            ? t("tasks.list.forDept", { dept: deptLabel(task.assigneeRole) })
            : t("tasks.list.personal")}
        {task.createdByName
          ? ` · ${t("tasks.list.byCreator", { name: task.createdByName })}`
          : ""}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">{task.due}</span>
        </span>
        <Badge className="shrink-0" variant={priorityVariant[task.priority]}>
          {t(`tasks.priority.${task.priority}`)}
        </Badge>
      </div>
    </div>
  );
}

export function TasksView() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<TaskStatus>("todo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

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

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const task of tasks) groups[task.status]?.push(task);
    return groups;
  }, [tasks]);

  // Optimistically move a task to a new column, then persist; roll back on fail.
  const moveTask = async (id: string, status: TaskStatus) => {
    const current = tasks.find((task) => task.id === id);
    if (!current || current.status === status) return;
    setTasks((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, status, done: status === "done" } : row,
      ),
    );
    try {
      await updateTask(id, { status });
    } catch {
      setTasks((prev) => prev.map((row) => (row.id === id ? current : row)));
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

  const removeTask = async () => {
    if (!selected) return;
    const id = selected.id;
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((task) => task.id !== id));
      setSheetOpen(false);
      notify.success(t("tasks.delete.doneTitle"), selected.title);
    } catch {
      notify.error(
        t("tasks.delete.failedTitle"),
        t("tasks.delete.failedBody"),
      );
    } finally {
      setConfirmOpen(false);
    }
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

  const openAdd = (status: TaskStatus) => {
    setAddStatus(status);
    setAddOpen(true);
  };

  const handleDrop = (event: DragEvent, status: TaskStatus) => {
    event.preventDefault();
    setDragOver(null);
    const id = dragId ?? event.dataTransfer.getData("text/plain");
    setDragId(null);
    if (id) void moveTask(id, status);
  };

  return (
    <div className="flex h-full w-full flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("tasks.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("tasks.subtitle")}</p>
        </div>
        <Button onClick={() => openAdd("todo")} type="button">
          <Plus className="size-4" />
          {t("tasks.board.newTask")}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((status) => {
          const column = byStatus[status];
          return (
            <section
              className={cn(
                "flex min-h-0 flex-col gap-3 rounded-2xl border bg-card/30 p-3 transition-colors",
                dragOver === status && "border-ring bg-accent/40",
              )}
              key={status}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("size-2 rounded-full", columnDot[status])}
                  />
                  <span className="font-medium text-sm">
                    {t(`tasks.status.${status}`)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {column.length}
                  </span>
                </div>
                <Button
                  aria-label={t("tasks.board.addTask")}
                  onClick={() => openAdd(status)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {column.length === 0 ? (
                  <p className="px-1 py-6 text-center text-muted-foreground text-xs">
                    {t("tasks.board.emptyColumn")}
                  </p>
                ) : (
                  column.map((task) => (
                    <TaskCard
                      key={task.id}
                      onDragStart={() => setDragId(task.id)}
                      onOpen={() => openTask(task.id)}
                      task={task}
                    />
                  ))
                )}
                <Button
                  className="justify-start text-muted-foreground"
                  onClick={() => openAdd(status)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Plus className="size-4" />
                  {t("tasks.board.addTask")}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <AddTaskDialog
        initialStatus={addStatus}
        onAdd={addTask}
        onOpenChange={setAddOpen}
        open={addOpen}
      />

      <TaskDetailSheet
        onDelete={() => setConfirmOpen(true)}
        onMove={moveTask}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        task={selected}
      />

      <ConfirmDialog
        cancelLabel={t("tasks.delete.cancel")}
        confirmLabel={t("tasks.delete.confirm")}
        description={
          selected
            ? t("tasks.delete.body", { title: selected.title })
            : undefined
        }
        onConfirm={removeTask}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t("tasks.delete.title")}
      />
    </div>
  );
}
