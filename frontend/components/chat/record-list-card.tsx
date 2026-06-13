"use client";

import { CalendarClock, ClipboardList, Pill } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
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

export function AppointmentListCard({ appointments }: { appointments: Appointment[] }) {
  const { t } = useTranslation();
  const rows: Row[] = appointments.map((a) => ({
    primary: a.name,
    secondary: [a.date, a.time, a.type, a.provider].filter(Boolean).join(" · "),
    badge: a.status,
  }));
  return (
    <Shell
      emptyKey="chat.lists.noAppointments"
      icon={CalendarClock}
      rows={rows}
      title={t("chat.lists.appointments")}
    />
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
