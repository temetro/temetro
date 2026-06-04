"use client";

import { CalendarClock, Clock, Plus, Stethoscope, Users } from "lucide-react";
import { type ReactNode, useState } from "react";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// All figures here are mock/placeholder data — there is no scheduling backend.
// They illustrate the Appointments & Schedule layout.

type ApptStatus = "confirmed" | "checked-in" | "completed" | "cancelled";

type Appointment = {
  time: string;
  name: string;
  initials: string;
  type: string;
  provider: string;
  status: ApptStatus;
};

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

const kpis = [
  { label: "Today", value: "12", icon: CalendarClock },
  { label: "This week", value: "146", icon: Users },
  { label: "Avg. visit", value: "22 min", icon: Clock },
  { label: "Utilization", value: "87%", icon: Stethoscope },
];

const today: Appointment[] = [
  {
    time: "09:00",
    name: "Amina Yusuf",
    initials: "AY",
    type: "Follow-up",
    provider: "Dr. Okafor",
    status: "completed",
  },
  {
    time: "09:30",
    name: "Daniel Mensah",
    initials: "DM",
    type: "New patient",
    provider: "Dr. Okafor",
    status: "checked-in",
  },
  {
    time: "10:15",
    name: "Leila Haddad",
    initials: "LH",
    type: "Lab review",
    provider: "Dr. Stein",
    status: "confirmed",
  },
  {
    time: "11:00",
    name: "Carlos Rivera",
    initials: "CR",
    type: "Consultation",
    provider: "Dr. Okafor",
    status: "confirmed",
  },
  {
    time: "13:30",
    name: "Priya Nair",
    initials: "PN",
    type: "Follow-up",
    provider: "Dr. Stein",
    status: "cancelled",
  },
  {
    time: "14:45",
    name: "Tom Becker",
    initials: "TB",
    type: "Vaccination",
    provider: "Dr. Okafor",
    status: "confirmed",
  },
];

const upcoming: { day: string; items: Appointment[] }[] = [
  {
    day: "Tomorrow",
    items: [
      {
        time: "08:45",
        name: "Grace Lin",
        initials: "GL",
        type: "Follow-up",
        provider: "Dr. Stein",
        status: "confirmed",
      },
      {
        time: "10:00",
        name: "Omar Farouk",
        initials: "OF",
        type: "New patient",
        provider: "Dr. Okafor",
        status: "confirmed",
      },
    ],
  },
];

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

function ScheduleList({ items }: { items: Appointment[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
      {items.map((appt) => (
        <ApptRow appt={appt} key={appt.time + appt.name} />
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
  // Bumped on open so the create dialog remounts with a fresh file # / form.
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Appointments &amp; Schedule
          </h1>
          <p className="text-muted-foreground text-sm">
            Today&apos;s clinic schedule and what&apos;s coming up. Sample data.
          </p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => {
            setAddKey((k) => k + 1);
            setAddOpen(true);
          }}
          type="button"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <Section description="Wednesday, June 5" title="Today">
        <ScheduleList items={today} />
      </Section>

      {upcoming.map((group) => (
        <Section key={group.day} title={group.day}>
          <ScheduleList items={group.items} />
        </Section>
      ))}

      <PatientFormDialog
        key={addKey}
        mode="create"
        onCreated={() => setAddOpen(false)}
        onOpenChange={setAddOpen}
        open={addOpen}
      />
    </div>
  );
}
