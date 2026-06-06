"use client";

import { Check, Plus } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

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
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

// All tasks here are mock/placeholder data — there is no tasks backend. They
// illustrate a care-team to-do board.

export type Priority = "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  assignee: string;
  due: string;
  priority: Priority;
  patient?: string;
  notes?: string;
  done: boolean;
};

type Filter = "all" | "open" | "done";

const priorityVariant: Record<Priority, "destructive" | "secondary" | "outline"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

const priorityLabel: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const seed: Task[] = [
  {
    id: "1",
    title: "Review Amina Yusuf's lab results",
    assignee: "Dr. Okafor",
    due: "Today",
    priority: "high",
    patient: "Amina Yusuf · #10293",
    notes: "Lipid panel + HbA1c back. Decide whether to adjust the plan before her follow-up.",
    done: false,
  },
  {
    id: "2",
    title: "Confirm Daniel Mensah's prior records import",
    assignee: "Reception",
    due: "Today",
    priority: "medium",
    patient: "Daniel Mensah · #10311",
    notes: "Check the import completed before tomorrow's 10:00 appointment.",
    done: false,
  },
  {
    id: "3",
    title: "Call Carlos Rivera about expired statin",
    assignee: "Dr. Okafor",
    due: "Tomorrow",
    priority: "medium",
    patient: "Carlos Rivera · #10358",
    done: false,
  },
  {
    id: "4",
    title: "Restock vaccination fridge log",
    assignee: "Care team",
    due: "Jun 8",
    priority: "low",
    done: true,
  },
];

function CheckButton({
  done,
  onClick,
}: {
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={done ? "Mark as not done" : "Mark as done"}
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
  onAdd: (task: Omit<Task, "id" | "done">) => void;
}) {
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
      notify.error("Add a subject", "Describe the task first.");
      return;
    }
    onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      assignee: assignee.trim() || "Unassigned",
      due: due.trim() || "No due date",
      priority,
    });
    notify.success("Task added", title.trim());
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
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Assign a follow-up to the care team.
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label="Subject">
              <Input
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Review lab results"
                value={title}
              />
            </Field>
            <Field label="Details — what needs to be done">
              <Textarea
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe what needs to happen, any context, links…"
                rows={4}
                value={notes}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assignee">
                <Input
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. Dr. Okafor"
                  value={assignee}
                />
              </Field>
              <Field label="Due">
                <Input
                  onChange={(e) => setDue(e.target.value)}
                  placeholder="e.g. Today"
                  value={due}
                />
              </Field>
            </div>
            <Field label="Priority">
              <select
                className={controlClass}
                onChange={(e) => setPriority(e.target.value as Priority)}
                value={priority}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit">Add task</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const visible = useMemo(() => {
    if (filter === "open") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, filter]);

  const toggle = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const openTask = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const addTask = (task: Omit<Task, "id" | "done">) =>
    setTasks((prev) => [
      { ...task, id: `t-${Date.now()}`, done: false },
      ...prev,
    ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Care-team to-dos. Click a task to see its details. Sample data.
          </p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      <div className="flex w-full items-center gap-1 rounded-2xl border bg-card/30 p-1 sm:w-fit">
        {(["all", "open", "done"] as Filter[]).map((f) => (
          <Button
            className="flex-1 capitalize sm:flex-none"
            key={f}
            onClick={() => setFilter(f)}
            size="sm"
            type="button"
            variant={filter === f ? "secondary" : "ghost"}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            No tasks here.
          </p>
        ) : (
          visible.map((t) => (
            <div className="flex items-center gap-3 px-4 py-3" key={t.id}>
              <CheckButton done={t.done} onClick={() => toggle(t.id)} />
              <button
                className="flex min-w-0 flex-1 flex-col text-left"
                onClick={() => openTask(t.id)}
                type="button"
              >
                <span
                  className={cn(
                    "truncate text-sm",
                    t.done
                      ? "text-muted-foreground line-through"
                      : "font-medium text-foreground",
                  )}
                >
                  {t.title}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {t.assignee} · {t.due}
                </span>
              </button>
              <Badge className="shrink-0" variant={priorityVariant[t.priority]}>
                {priorityLabel[t.priority]}
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
