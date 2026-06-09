"use client";

import {
  Activity as ActivityIcon,
  CalendarClock,
  CalendarDays,
  FileText,
  Hash,
  ListChecks,
  type LucideIcon,
  NotebookPen,
  Pill,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import {
  type ActivityEntityType,
  type ActivityEntry,
  listActivity,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

// A plain, tamper-evident audit log of record changes in the active clinic. (The
// blockchain-style signing / patient-approval flow from the product vision is
// separate and not built yet.)

const entityIcon: Record<ActivityEntityType, LucideIcon> = {
  patient: Stethoscope,
  note: NotebookPen,
  appointment: CalendarClock,
  prescription: Pill,
  task: ListChecks,
};

// ISO timestamp -> "Today, 10:24" / "Yesterday, 16:05" / "Jun 3, 14:30".
function formatTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return `Today, ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

// Full, unambiguous timestamp for the detail dialog.
function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-semibold text-foreground text-lg tracking-tight">
          {value}
        </span>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-foreground text-sm">{value}</span>
    </div>
  );
}

export function ActivityView() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [selected, setSelected] = useState<ActivityEntry | null>(null);

  useEffect(() => {
    let active = true;
    listActivity()
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the feed empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - now.getDay());
    const today = entries.filter((e) => new Date(e.createdAt) >= startOfToday);
    const week = entries.filter((e) => new Date(e.createdAt) >= startOfWeek);
    return [
      {
        label: t("activity.changesToday"),
        value: String(today.length),
        icon: ActivityIcon,
      },
      { label: t("activity.thisWeek"), value: String(week.length), icon: CalendarDays },
      {
        label: t("activity.totalRecorded"),
        value: String(entries.length),
        icon: Hash,
      },
    ];
  }, [entries, t]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("activity.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("activity.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/20 px-4 py-12 text-center text-muted-foreground text-sm">
          {t("activity.empty")}
        </div>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, i) => {
            const Icon = entityIcon[entry.entityType] ?? FileText;
            const isLast = i === entries.length - 1;
            const context = [
              entry.actorName,
              entry.patientName &&
                `${entry.patientName}${
                  entry.patientFileNumber ? ` (#${entry.patientFileNumber})` : ""
                }`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li className="flex gap-4" key={entry.id}>
                <div className="flex flex-col items-center">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
                </div>

                <button
                  className={cn(
                    "-mx-2 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent/40",
                    isLast ? "pb-1" : "mb-5",
                  )}
                  onClick={() => setSelected(entry)}
                  type="button"
                >
                  <span className="font-medium text-foreground text-sm">
                    {entry.action}
                  </span>

                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[10px]">
                        {entry.actorInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground text-xs">
                      {context}
                    </span>
                  </div>

                  <div className="mt-2 text-muted-foreground text-xs">
                    {formatTime(entry.createdAt)}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        onOpenChange={(o) => !o && setSelected(null)}
        open={selected !== null}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("activity.detail.title")}</DialogTitle>
            <DialogDescription>{selected?.action}</DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-2.5">
            <DetailRow
              label={t("activity.detail.person")}
              value={selected?.actorName ?? ""}
            />
            <DetailRow
              label={t("activity.detail.record")}
              value={
                selected
                  ? t(`activity.detail.entityTypes.${selected.entityType}`)
                  : ""
              }
            />
            {selected?.patientName && (
              <DetailRow
                label={t("activity.detail.patient")}
                value={`${selected.patientName}${
                  selected.patientFileNumber
                    ? ` (#${selected.patientFileNumber})`
                    : ""
                }`}
              />
            )}
            {selected?.entityId && !selected?.patientFileNumber && (
              <DetailRow
                label={t("activity.detail.reference")}
                value={selected.entityId}
              />
            )}
            <DetailRow
              label={t("activity.detail.time")}
              value={selected ? formatFullTime(selected.createdAt) : ""}
            />
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("activity.detail.close")}
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
