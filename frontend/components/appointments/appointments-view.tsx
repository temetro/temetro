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
import { type ReactNode, useEffect, useMemo, useState } from "react";

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

const statusLabel: Record<ApptStatus, string> = {
  "checked-in": "Checked in",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
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

function ApptRow({ appt }: { appt: Appointment }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
      <Badge variant={statusVariant[appt.status]}>{statusLabel[appt.status]}</Badge>
    </div>
  );
}

export function ScheduleList({ items }: { items: Appointment[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
      {items.map((appt) => (
        <ApptRow appt={appt} key={appt.id} />
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
  const [addOpen, setAddOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState("");

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
      notify.error("Couldn't add appointment", "Please try again.");
    }
  };

  const kpis = useMemo(() => {
    const { start, end } = weekRange();
    const today = appointments.filter((a) => a.date === TODAY);
    const week = appointments.filter((a) => a.date >= start && a.date <= end);
    return [
      { label: "Today", value: String(today.length), icon: CalendarClock },
      { label: "This week", value: String(week.length), icon: Users },
      {
        label: "Checked in",
        value: String(today.filter((a) => a.status === "checked-in").length),
        icon: Stethoscope,
      },
      {
        label: "Completed",
        value: String(today.filter((a) => a.status === "completed").length),
        icon: Clock,
      },
    ];
  }, [appointments]);

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
            Appointments &amp; Schedule
          </h1>
          <p className="text-muted-foreground text-sm">
            Today&apos;s clinic schedule and what&apos;s coming up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patient, type, provider"
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
            Calendar
          </Button>
          <Button
            className="rounded-3xl"
            onClick={() => setAddOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {search ? (
        results.length > 0 ? (
          results.map((group) => (
            <Section key={group.key} title={formatDayKey(group.key)}>
              <ScheduleList items={group.items} />
            </Section>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed bg-card/20 px-4 py-8 text-center text-muted-foreground text-sm">
            No matching appointments.
          </p>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <Kpi key={k.label} {...k} />
            ))}
          </div>

          <Section description={formatDayKey(TODAY)} title="Today">
            {todayItems.length > 0 ? (
              <ScheduleList items={todayItems} />
            ) : (
              <p className="rounded-2xl border border-dashed bg-card/20 px-4 py-8 text-center text-muted-foreground text-sm">
                Nothing scheduled today.
              </p>
            )}
          </Section>

          {upcoming.map((group) => (
            <Section key={group.key} title={formatDayKey(group.key)}>
              <ScheduleList items={group.items} />
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
        onOpenChange={setCalendarOpen}
        open={calendarOpen}
      />
    </div>
  );
}
