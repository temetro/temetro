"use client";

import { Check, ListTodo, Plus } from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

// All tasks here are mock/placeholder data — there is no tasks backend. They
// illustrate a care-team to-do board.

type Priority = "high" | "medium" | "low";

type Task = {
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
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
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
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const reset = () => {
    setTitle("");
    setAssignee("");
    setDue("");
    setPriority("medium");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      notify.error("Add a title", "Describe the task first.");
      return;
    }
    onAdd({
      title: title.trim(),
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
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Assign a follow-up to the care team.
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label="Title">
              <Input
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Review lab results"
                value={title}
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

  const addTask = (task: Omit<Task, "id" | "done">) =>
    setTasks((prev) => [
      { ...task, id: `t-${Date.now()}`, done: false },
      ...prev,
    ]);

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* Left: task list */}
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">Tasks</h1>
          <Button
            aria-label="New task"
            onClick={() => setAddOpen(true)}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-border border-b px-2 py-2">
          {(["all", "open", "done"] as Filter[]).map((f) => (
            <Button
              className="flex-1 capitalize"
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

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              No tasks here.
            </p>
          ) : (
            visible.map((t) => (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50",
                  selected?.id === t.id && "bg-accent",
                )}
                key={t.id}
              >
                <CheckButton done={t.done} onClick={() => toggle(t.id)} />
                <button
                  className="flex min-w-0 flex-1 flex-col text-left"
                  onClick={() => setSelectedId(t.id)}
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
      </aside>

      {/* Right: task detail or empty state */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected ? (
          <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border bg-card/30 p-6">
            <div className="flex items-start justify-between gap-3">
              <h2
                className={cn(
                  "font-semibold text-foreground text-xl tracking-tight",
                  selected.done && "text-muted-foreground line-through",
                )}
              >
                {selected.title}
              </h2>
              <Badge variant={priorityVariant[selected.priority]}>
                {priorityLabel[selected.priority]}
              </Badge>
            </div>

            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground">
                {selected.done ? "Completed" : "Open"}
              </dd>
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="text-foreground">{selected.assignee}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="text-foreground">{selected.due}</dd>
              {selected.patient && (
                <>
                  <dt className="text-muted-foreground">Patient</dt>
                  <dd className="text-foreground">{selected.patient}</dd>
                </>
              )}
            </dl>

            {selected.notes && (
              <p className="text-foreground text-sm leading-relaxed">
                {selected.notes}
              </p>
            )}

            <div>
              <Button
                onClick={() => toggle(selected.id)}
                type="button"
                variant={selected.done ? "outline" : "default"}
              >
                {selected.done ? "Reopen task" : "Mark complete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border bg-card/30">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListTodo />
                </EmptyMedia>
                <EmptyTitle>No task selected</EmptyTitle>
                <EmptyDescription>
                  Select a task to see its details, or create a new one.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>

      <AddTaskDialog onAdd={addTask} onOpenChange={setAddOpen} open={addOpen} />
    </div>
  );
}
