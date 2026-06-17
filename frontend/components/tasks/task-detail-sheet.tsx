"use client";

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/access";
import type { TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { Priority, Task } from "@/components/tasks/tasks-view";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

const priorityVariant: Record<Priority, "destructive" | "secondary" | "outline"> =
  {
    high: "destructive",
    medium: "secondary",
    low: "outline",
  };

function deptLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

// Right-side Sheet showing a single task's full detail, opened from the Tasks
// list (mirrors the Patients table → PatientDetailSheet pattern). The task is
// passed in directly from the page.
export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onMove,
  onDelete,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (id: string, status: TaskStatus) => void;
  onDelete?: () => void;
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
                  {t(`tasks.status.${task.status}`)}
                </dd>
                <dt className="text-muted-foreground">
                  {t("tasks.detail.assignedTo")}
                </dt>
                <dd className="text-foreground">
                  {task.assigneeRole
                    ? t("tasks.detail.deptTeam", {
                        dept: deptLabel(task.assigneeRole),
                      })
                    : t("tasks.detail.personal")}
                </dd>
                <dt className="text-muted-foreground">
                  {t("tasks.detail.createdBy")}
                </dt>
                <dd className="text-foreground">{task.createdByName ?? "—"}</dd>
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

              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {t("tasks.detail.moveTo")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      onClick={() => onMove(task.id, s)}
                      size="sm"
                      type="button"
                      variant={task.status === s ? "default" : "outline"}
                    >
                      {t(`tasks.status.${s}`)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetPanel>
        {task && onDelete && (
          <SheetFooter>
            <Button onClick={onDelete} type="button" variant="destructive">
              <Trash2 className="size-4" />
              {t("tasks.detail.delete")}
            </Button>
          </SheetFooter>
        )}
      </SheetPopup>
    </Sheet>
  );
}
