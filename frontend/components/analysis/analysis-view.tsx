"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Sparkline } from "@/components/chat/sparkline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// All figures here are mock/placeholder data — there is no analytics backend.
// They illustrate the dashboard layout (clinic profits, patient volume, etc.).

type Metric = {
  label: string;
  value: string;
  // % change vs the previous period; sign drives the up/down badge.
  delta?: number;
  points?: number[];
  // Tailwind text-color class tinting the sparkline (via currentColor).
  tone?: string;
};

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <Badge variant={up ? "secondary" : "destructive"}>
      {up ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {up ? "+" : ""}
      {delta}%
    </Badge>
  );
}

function StatCard({ label, value, delta, points, tone }: Metric) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground text-sm">{label}</span>
        {typeof delta === "number" && <DeltaBadge delta={delta} />}
      </div>
      <div className="font-semibold text-2xl text-foreground tracking-tight">
        {value}
      </div>
      {points && (
        <div className={cn("h-10", tone ?? "text-primary")}>
          <Sparkline points={points} />
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

const revenue: Metric[] = [
  {
    label: "Revenue (this month)",
    value: "$48.2k",
    delta: 12,
    points: [31, 34, 33, 38, 41, 44, 48.2],
    tone: "text-emerald-500",
  },
  {
    label: "Profit margin",
    value: "32%",
    delta: 4,
    points: [24, 26, 25, 28, 30, 31, 32],
    tone: "text-emerald-500",
  },
  {
    label: "Outstanding balances",
    value: "$6.4k",
    delta: -8,
    points: [9.1, 8.4, 8.8, 7.6, 7.0, 6.7, 6.4],
    tone: "text-amber-500",
  },
];

const volume: Metric[] = [
  {
    label: "New patients",
    value: "38",
    delta: 9,
    points: [22, 27, 25, 30, 33, 35, 38],
    tone: "text-sky-500",
  },
  {
    label: "Returning patients",
    value: "212",
    delta: 3,
    points: [188, 196, 201, 199, 205, 209, 212],
    tone: "text-sky-500",
  },
  {
    label: "Active patients",
    value: "1,284",
    delta: 2,
    points: [1190, 1210, 1230, 1242, 1260, 1271, 1284],
    tone: "text-sky-500",
  },
];

const appointments: Metric[] = [
  {
    label: "Appointments this week",
    value: "146",
    delta: 6,
    points: [120, 128, 131, 134, 139, 142, 146],
    tone: "text-violet-500",
  },
  { label: "No-show rate", value: "4.1%", delta: -2 },
  { label: "Schedule utilization", value: "87%", delta: 5 },
];

const operations: Metric[] = [
  {
    label: "Avg. wait time",
    value: "14 min",
    delta: -11,
    points: [22, 21, 19, 18, 17, 15, 14],
    tone: "text-amber-500",
  },
  {
    label: "Prescriptions issued",
    value: "318",
    delta: 7,
    points: [270, 281, 290, 297, 305, 312, 318],
    tone: "text-primary",
  },
  { label: "Top diagnosis", value: "Hypertension" },
];

export function AnalysisView() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Analysis</h1>
        <p className="text-muted-foreground text-sm">
          Clinic performance at a glance. Figures are sample data.
        </p>
      </div>

      <Section
        description="Earnings, margin and receivables"
        title="Revenue & profit"
      >
        {revenue.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </Section>

      <Section
        description="New, returning and active patients"
        title="Patient volume"
      >
        {volume.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </Section>

      <Section
        description="Bookings, attendance and capacity"
        title="Appointments & schedule"
      >
        {appointments.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </Section>

      <Section
        description="Throughput, prescribing and case mix"
        title="Clinic operations"
      >
        {operations.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </Section>
    </div>
  );
}
