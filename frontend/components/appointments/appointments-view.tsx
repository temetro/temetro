"use client";

import {
  CalendarClock,
  CalendarDays,
  Clock,
  Plus,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet";
import {
  AddAppointmentDialog,
  type NewAppointment,
} from "@/components/appointments/add-appointment-dialog";
import { CalendarDialog } from "@/components/appointments/calendar-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type Appointment,
  createAppointment,
  listAppointments,
} from "@/lib/appointments";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type { Appointment } from "@/lib/appointments";

// Local-date ISO key (avoids UTC drift from toISOString).
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

// "Today" is the real current date — appointments are persisted, not seeded, so
// the schedule and calendar anchor to now. ISO YYYY-MM-DD.
export const TODAY = keyOf(new Date());

// Sunday-anchored week window [start, end] as ISO keys, for the "This week" KPI.
function weekRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: keyOf(start), end: keyOf(end) };
}

type ApptStatus = Appointment["status"];

const statusVariant: Record<
  ApptStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  "checked-in": "default",
  confirmed: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

// "2026-06-05" -> "Wednesday, June 5"
function formatDayKey(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function byTime(a: Appointment, b: Appointment) {
  return a.time.localeCompare(b.time);
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CalendarClock;
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

function ApptRow({
  appt,
  onOpen,
}: {
  appt: Appointment;
  onOpen?: (appt: Appointment) => void;
}) {
  const { t } = useTranslation();
  const interactive = Boolean(onOpen);
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        interactive && "cursor-pointer transition-colors hover:bg-accent/50",
      )}
      onClick={interactive ? () => onOpen?.(appt) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.(appt);
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="w-12 shrink-0 font-medium text-foreground text-sm tabular-nums">
        {appt.time}
      </span>
      <Avatar className="size-8">
        <AvatarFallback>{appt.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground text-sm">
          {appt.name}
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {appt.type} · {appt.provider}
        </span>
      </div>
      <AiBadge source={appt.source} />
      <Badge variant={statusVariant[appt.status]}>
        {t(`appointments.status.${appt.status}`)}
      </Badge>
    </div>
  );
}

export function ScheduleList({
  items,
  onOpen,
}: {
  items: Appointment[];
  onOpen?: (appt: Appointment) => void;
}) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
      {items.map((appt) => (
        <ApptRow appt={appt} key={appt.id} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function AppointmentsView() {
  const { t } = useTranslation();
  // Deep-link from the AI chat appointment card: `?calendar=1&date=YYYY-MM-DD`
  // opens the month calendar on that date.
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const [addOpen, setAddOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(
    () => searchParams.get("calendar") != null,
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openAppt = (appt: Appointment) => {
    setSelectedAppt(appt);
    setSheetOpen(true);
  };

  useEffect(() => {
    let active = true;
    listAppointments()
      .then((data) => {
        if (active) setAppointments(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the list empty */
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist a new appointment, then add the saved record to the list.
  const addAppointment = async (appt: NewAppointment) => {
    try {
      const created = await createAppointment({
        fileNumber: appt.fileNumber,
        name: appt.name,
        initials: appt.initials,
        date: appt.date,
        time: appt.time,
        type: appt.type,
        provider: appt.provider,
      });
      setAppointments((prev) => [...prev, created]);
    } catch {
      notify.error(
        t("appointments.addFailedTitle"),
        t("appointments.addFailedBody"),
      );
    }
  };

  const kpis = useMemo(() => {
    const { start, end } = weekRange();
    const today = appointments.filter((a) => a.date === TODAY);
    const week = appointments.filter((a) => a.date >= start && a.date <= end);
    return [
      { label: t("appointments.kpi.today"), value: String(today.length), icon: CalendarClock },
      { label: t("appointments.kpi.thisWeek"), value: String(week.length), icon: Users },
      {
        label: t("appointments.kpi.checkedIn"),
        value: String(today.filter((a) => a.status === "checked-in").length),
        icon: Stethoscope,
      },
      {
        label: t("appointments.kpi.completed"),
        value: String(today.filter((a) => a.status === "completed").length),
        icon: Clock,
      },
    ];
  }, [appointments, t]);

  const todayItems = useMemo(
    () => appointments.filter((a) => a.date === TODAY).sort(byTime),
    [appointments],
  );

  // Group future dates (after TODAY) into day sections, soonest first.
  const upcoming = useMemo(() => {
    const keys = [
      ...new Set(appointments.map((a) => a.date).filter((d) => d > TODAY)),
    ].sort();
    return keys.map((key) => ({
      key,
      items: appointments.filter((a) => a.date === key).sort(byTime),
    }));
  }, [appointments]);

  const search = query.trim().toLowerCase();

  // While searching, match name/type/provider across every date and group the
  // hits by date (soonest first) so each section keeps its day header.
  const results = useMemo(() => {
    if (!search) return [];
    const hits = appointments.filter(
      (a) =>
        a.name.toLowerCase().includes(search) ||
        a.type.toLowerCase().includes(search) ||
        a.provider.toLowerCase().includes(search),
    );
    const keys = [...new Set(hits.map((a) => a.date))].sort();
    return keys.map((key) => ({
      key,
      items: hits.filter((a) => a.date === key).sort(byTime),
    }));
  }, [appointments, search]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("appointments.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("appointments.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 start-3 size-4 text-muted-foreground" />
            <Input
              className="w-full ps-9 sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("appointments.searchPlaceholder")}
              value={query}
            />
          </div>
          <Button
            className="rounded-3xl"
            onClick={() => setCalendarOpen(true)}
            type="button"
            variant="outline"
          >
            <CalendarDays className="size-4" />
            {t("appointments.calendar")}
          </Button>
          <Button
            className="rounded-3xl"
            onClick={() => setAddOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            {t("appointments.add")}
          </Button>
        </div>
      </div>

      {search ? (
        results.length > 0 ? (
          results.map((group) => (
            <Section key={group.key} title={formatDayKey(group.key)}>
              <ScheduleList items={group.items} onOpen={openAppt} />
            </Section>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed bg-card/20 px-4 py-8 text-center text-muted-foreground text-sm">
            {t("appointments.noMatches")}
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <Kpi key={k.label} {...k} />
            ))}
          </div>

          <Section description={formatDayKey(TODAY)} title={t("appointments.today")}>
            {todayItems.length > 0 ? (
              <ScheduleList items={todayItems} onOpen={openAppt} />
            ) : (
              <p className="rounded-2xl border border-dashed bg-card/20 px-4 py-8 text-center text-muted-foreground text-sm">
                {t("appointments.nothingToday")}
              </p>
            )}
          </Section>

          {upcoming.map((group) => (
            <Section key={group.key} title={formatDayKey(group.key)}>
              <ScheduleList items={group.items} onOpen={openAppt} />
            </Section>
          ))}
        </>
      )}

      <AddAppointmentDialog
        onAdd={addAppointment}
        onOpenChange={setAddOpen}
        open={addOpen}
      />

      <CalendarDialog
        appointments={appointments}
        initialDate={dateParam}
        onOpenChange={setCalendarOpen}
        open={calendarOpen}
      />

      <AppointmentDetailSheet
        appt={selectedAppt}
        onDeleted={(id) =>
          setAppointments((prev) => prev.filter((a) => a.id !== id))
        }
        onOpenChange={setSheetOpen}
        onSaved={(updated) =>
          setAppointments((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          )
        }
        open={sheetOpen}
      />
    </div>
  );
}
