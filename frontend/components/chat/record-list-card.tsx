"use client";

import { CalendarClock, ChevronRight, ClipboardList, Pill } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Appointment } from "@/lib/appointments";
import { formatPrescribedAt, type Prescription } from "@/lib/prescriptions";
import type { Task } from "@/lib/tasks";

type Row = { primary: string; secondary?: string; badge?: string };

function Shell({
  icon: Icon,
  title,
  rows,
  emptyKey,
}: {
  icon: LucideIcon;
  title: string;
  rows: Row[];
  emptyKey: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        <Badge className="ml-auto" variant="secondary">
          {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-muted-foreground text-sm">
          {t(emptyKey)}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row, i) => (
            <div className="flex items-center gap-3 px-4 py-2.5" key={row.primary + i}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground text-sm">
                  {row.primary}
                </span>
                {row.secondary ? (
                  <span className="truncate text-muted-foreground text-xs">
                    {row.secondary}
                  </span>
                ) : null}
              </div>
              {row.badge ? (
                <Badge className="shrink-0" variant="outline">
                  {row.badge}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// "2026-06-16" -> "Jun 16" (compact, for the date-range summary).
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Appointments are rendered condensed: rather than one dense card per row (which
// floods the chat for a week's schedule), show a small summary + a few previews
// and send the clinician to the Appointments calendar for the full picture.
const APPT_PREVIEW = 3;

export function AppointmentListCard({
  appointments,
}: {
  appointments: Appointment[];
}) {
  const { t } = useTranslation();

  if (appointments.length === 0) {
    return (
      <Shell
        emptyKey="chat.lists.noAppointments"
        icon={CalendarClock}
        rows={[]}
        title={t("chat.lists.appointments")}
      />
    );
  }

  const dates = appointments.map((a) => a.date).filter(Boolean).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const range = first
    ? first === last
      ? shortDate(first)
      : `${shortDate(first)} – ${shortDate(last as string)}`
    : "";
  // Deep-link to the Appointments calendar, opened on the first appointment's
  // month (the page reads `?calendar=1&date=`).
  const href = first
    ? `/appointments?calendar=1&date=${first}`
    : "/appointments?calendar=1";
  const preview = appointments.slice(0, APPT_PREVIEW);
  const remaining = appointments.length - preview.length;

  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <CalendarClock className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.lists.appointments")}
        </span>
        {range ? (
          <span className="text-muted-foreground text-xs">{range}</span>
        ) : null}
        <Badge className="ml-auto" variant="secondary">
          {appointments.length}
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {preview.map((a, i) => (
          <div className="flex items-center gap-3 px-4 py-2.5" key={a.id ?? i}>
            <span className="w-12 shrink-0 text-muted-foreground text-xs tabular-nums">
              {a.time}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-foreground text-sm">
                {a.name}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {[shortDate(a.date), a.type, a.provider]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <Badge className="shrink-0" variant="outline">
              {a.status}
            </Badge>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">
          {remaining > 0
            ? t("chat.lists.moreAppointments", { count: remaining })
            : ""}
        </span>
        <Button render={<Link href={href} />} size="sm" variant="ghost">
          {t("chat.lists.viewInCalendar")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

export function TaskListCard({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation();
  const rows: Row[] = tasks.map((tk) => ({
    primary: tk.title,
    secondary: [tk.assignee, tk.due].filter(Boolean).join(" · "),
    badge: tk.done ? t("chat.lists.done") : tk.priority,
  }));
  return (
    <Shell
      emptyKey="chat.lists.noTasks"
      icon={ClipboardList}
      rows={rows}
      title={t("chat.lists.tasks")}
    />
  );
}

export function PrescriptionListCard({
  prescriptions,
}: {
  prescriptions: Prescription[];
}) {
  const { t } = useTranslation();
  const rows: Row[] = prescriptions.map((rx) => ({
    primary: [rx.medication, rx.dose].filter(Boolean).join(" "),
    secondary: [rx.name, rx.frequency, formatPrescribedAt(rx.prescribedAt)]
      .filter(Boolean)
      .join(" · "),
    badge: rx.status,
  }));
  return (
    <Shell
      emptyKey="chat.lists.noPrescriptions"
      icon={Pill}
      rows={rows}
      title={t("chat.lists.prescriptions")}
    />
  );
}
