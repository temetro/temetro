"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/components/tasks/tasks-view";

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

// Right-side Sheet showing a single task's full detail, opened from the Tasks
// list (mirrors the Patients table → PatientDetailSheet pattern). The task is
// passed in directly since tasks live in local state — no async fetch.
export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onToggle,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle
            className={cn(task?.done && "text-muted-foreground line-through")}
          >
            {task?.title ?? "Task"}
          </SheetTitle>
        </SheetHeader>
        <SheetPanel className="min-h-0 flex-1">
          {task && (
            <div className="flex flex-col gap-5">
              <div>
                <Badge variant={priorityVariant[task.priority]}>
                  {priorityLabel[task.priority]} priority
                </Badge>
              </div>

              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-foreground">
                  {task.done ? "Completed" : "Open"}
                </dd>
                <dt className="text-muted-foreground">Assignee</dt>
                <dd className="text-foreground">{task.assignee}</dd>
                <dt className="text-muted-foreground">Due</dt>
                <dd className="text-foreground">{task.due}</dd>
                {task.patient && (
                  <>
                    <dt className="text-muted-foreground">Patient</dt>
                    <dd className="text-foreground">{task.patient}</dd>
                  </>
                )}
              </dl>

              {task.notes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">Details</span>
                  <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
                    {task.notes}
                  </p>
                </div>
              )}

              <div>
                <Button
                  onClick={() => onToggle(task.id)}
                  type="button"
                  variant={task.done ? "outline" : "default"}
                >
                  {task.done ? "Reopen task" : "Mark complete"}
                </Button>
              </div>
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
