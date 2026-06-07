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

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
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

export function ActivityView() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

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
      { label: "Changes today", value: String(today.length), icon: ActivityIcon },
      { label: "This week", value: String(week.length), icon: CalendarDays },
      { label: "Total recorded", value: String(entries.length), icon: Hash },
    ];
  }, [entries]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          An audit log of record changes across the clinic.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/20 px-4 py-12 text-center text-muted-foreground text-sm">
          No activity yet. Changes to patients, notes, appointments,
          prescriptions and tasks will appear here.
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

                <div className={cn("flex-1", isLast ? "pb-0" : "pb-6")}>
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
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
