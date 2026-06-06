"use client";

import { CircleCheck, Clock, Pill, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
  AddPrescriptionDialog,
  type NewPrescription,
} from "@/components/prescriptions/add-prescription-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// All figures here are mock/placeholder data — there is no prescriptions backend.
// They illustrate the Prescriptions layout.

type RxStatus = "active" | "completed" | "expired";

type Prescription = {
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  frequency: string;
  prescriber: string;
  date: string;
  status: RxStatus;
};

const statusVariant: Record<
  RxStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  completed: "outline",
  expired: "destructive",
};

const statusLabel: Record<RxStatus, string> = {
  active: "Active",
  completed: "Completed",
  expired: "Expired",
};

const kpis = [
  { label: "Active", value: "8", icon: Pill },
  { label: "Due refill", value: "3", icon: Clock },
  { label: "Completed", value: "27", icon: CircleCheck },
];

const initial: Prescription[] = [
  {
    fileNumber: "10293",
    name: "Amina Yusuf",
    initials: "AY",
    medication: "Lisinopril",
    dose: "10 mg",
    frequency: "Once daily",
    prescriber: "Dr. Okafor",
    date: "Jun 5, 2026",
    status: "active",
  },
  {
    fileNumber: "10311",
    name: "Daniel Mensah",
    initials: "DM",
    medication: "Metformin",
    dose: "500 mg",
    frequency: "Twice daily",
    prescriber: "Dr. Okafor",
    date: "Jun 4, 2026",
    status: "active",
  },
  {
    fileNumber: "10342",
    name: "Leila Haddad",
    initials: "LH",
    medication: "Amoxicillin",
    dose: "500 mg",
    frequency: "Three times daily",
    prescriber: "Dr. Stein",
    date: "May 28, 2026",
    status: "completed",
  },
  {
    fileNumber: "10358",
    name: "Carlos Rivera",
    initials: "CR",
    medication: "Atorvastatin",
    dose: "20 mg",
    frequency: "Once daily",
    prescriber: "Dr. Okafor",
    date: "May 12, 2026",
    status: "expired",
  },
  {
    fileNumber: "10377",
    name: "Priya Nair",
    initials: "PN",
    medication: "Salbutamol inhaler",
    dose: "100 mcg",
    frequency: "As needed",
    prescriber: "Dr. Stein",
    date: "Jun 1, 2026",
    status: "active",
  },
];

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Pill;
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

function RxRow({ rx }: { rx: Prescription }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar className="size-8">
        <AvatarFallback>{rx.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground text-sm">
          {rx.medication}
          {rx.dose && (
            <span className="font-normal text-muted-foreground"> · {rx.dose}</span>
          )}
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {rx.name} · #{rx.fileNumber} · {rx.frequency}
        </span>
      </div>
      <div className="hidden min-w-0 flex-col items-end sm:flex">
        <span className="truncate text-foreground text-xs">{rx.prescriber}</span>
        <span className="text-muted-foreground text-xs">{rx.date}</span>
      </div>
      <Badge variant={statusVariant[rx.status]}>{statusLabel[rx.status]}</Badge>
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

export function PrescriptionsView() {
  const [addOpen, setAddOpen] = useState(false);
  const [list, setList] = useState<Prescription[]>(initial);

  // Insert a new (mock) prescription at the top of the list, marked active.
  const addPrescription = (rx: NewPrescription) => {
    setList((prev) => [
      {
        fileNumber: rx.fileNumber,
        name: rx.name,
        initials: rx.initials,
        medication: rx.medication,
        dose: rx.dose,
        frequency: rx.frequency,
        prescriber: "Dr. Okafor",
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        status: "active" as const,
      },
      ...prev,
    ]);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Prescriptions</h1>
          <p className="text-muted-foreground text-sm">
            Medications prescribed across the clinic. Sample data.
          </p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          New prescription
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <Section description="Most recent first" title="Recent prescriptions">
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {list.map((rx) => (
            <RxRow key={rx.fileNumber + rx.medication + rx.date} rx={rx} />
          ))}
        </div>
      </Section>

      <AddPrescriptionDialog
        onAdd={addPrescription}
        onOpenChange={setAddOpen}
        open={addOpen}
      />
    </div>
  );
}
