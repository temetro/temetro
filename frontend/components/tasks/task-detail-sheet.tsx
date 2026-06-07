"use client";

import { useTranslation } from "react-i18next";

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

// Right-side Sheet showing a single task's full detail, opened from the Tasks
// list (mirrors the Patients table → PatientDetailSheet pattern). The task is
// passed in directly from the page.
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
  const { t } = useTranslation();
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle
            className={cn(task?.done && "text-muted-foreground line-through")}
          >
            {task?.title ?? t("tasks.detail.fallbackTitle")}
          </SheetTitle>
        </SheetHeader>
        <SheetPanel className="min-h-0 flex-1">
          {task && (
            <div className="flex flex-col gap-5">
              <div>
                <Badge variant={priorityVariant[task.priority]}>
                  {t("tasks.detail.priorityBadge", {
                    priority: t(`tasks.priority.${task.priority}`),
                  })}
                </Badge>
              </div>

              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">
                  {t("tasks.detail.status")}
                </dt>
                <dd className="text-foreground">
                  {task.done
                    ? t("tasks.detail.completed")
                    : t("tasks.detail.open")}
                </dd>
                <dt className="text-muted-foreground">
                  {t("tasks.detail.assignee")}
                </dt>
                <dd className="text-foreground">{task.assignee}</dd>
                <dt className="text-muted-foreground">
                  {t("tasks.detail.due")}
                </dt>
                <dd className="text-foreground">{task.due}</dd>
                {task.patient && (
                  <>
                    <dt className="text-muted-foreground">
                      {t("tasks.detail.patient")}
                    </dt>
                    <dd className="text-foreground">{task.patient}</dd>
                  </>
                )}
              </dl>

              {task.notes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">
                    {t("tasks.detail.details")}
                  </span>
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
                  {task.done
                    ? t("tasks.detail.reopen")
                    : t("tasks.detail.complete")}
                </Button>
              </div>
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
