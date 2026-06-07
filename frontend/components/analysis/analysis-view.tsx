"use client";

import { type ReactNode, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { type Analytics, getAnalytics } from "@/lib/analytics";

// Clinic analytics computed on the server from real data (patients,
// appointments, prescriptions, tasks). No fabricated financials — temetro has no
// billing data source.

type Metric = { label: string; value: string };

function StatCard({ label, value }: Metric) {
  return (
    <Card className="gap-3 p-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="font-semibold text-2xl text-foreground tracking-tight">
        {value}
      </div>
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

export function AnalysisView() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    let active = true;
    getAnalytics()
      .then((a) => {
        if (active) setData(a);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave it loading */
      });
    return () => {
      active = false;
    };
  }, []);

  const n = (v: number | undefined) => String(v ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Analysis</h1>
        <p className="text-muted-foreground text-sm">
          Clinic performance at a glance, computed from your clinic&apos;s data.
        </p>
      </div>

      <Section
        description="New, active and total patients"
        title="Patient volume"
      >
        <StatCard label="Total patients" value={n(data?.patients.total)} />
        <StatCard label="New this month" value={n(data?.patients.newThisMonth)} />
        <StatCard label="Active patients" value={n(data?.patients.active)} />
      </Section>

      <Section
        description="Bookings, attendance and what's coming up"
        title="Appointments & schedule"
      >
        <StatCard label="This week" value={n(data?.appointments.thisWeek)} />
        <StatCard label="Upcoming" value={n(data?.appointments.upcoming)} />
        <StatCard label="Completed" value={n(data?.appointments.completed)} />
        <StatCard label="Cancelled" value={n(data?.appointments.cancelled)} />
      </Section>

      <Section description="Medications prescribed" title="Prescriptions">
        <StatCard label="Total issued" value={n(data?.prescriptions.total)} />
        <StatCard label="Active" value={n(data?.prescriptions.active)} />
      </Section>

      <Section description="Care-team workload" title="Tasks">
        <StatCard label="Open" value={n(data?.tasks.open)} />
        <StatCard label="Completed" value={n(data?.tasks.done)} />
      </Section>
    </div>
  );
}
