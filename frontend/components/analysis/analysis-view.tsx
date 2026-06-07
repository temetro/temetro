"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("analysis.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("analysis.subtitle")}</p>
      </div>

      <Section
        description={t("analysis.patientVolume.description")}
        title={t("analysis.patientVolume.title")}
      >
        <StatCard
          label={t("analysis.patientVolume.total")}
          value={n(data?.patients.total)}
        />
        <StatCard
          label={t("analysis.patientVolume.newThisMonth")}
          value={n(data?.patients.newThisMonth)}
        />
        <StatCard
          label={t("analysis.patientVolume.active")}
          value={n(data?.patients.active)}
        />
      </Section>

      <Section
        description={t("analysis.appointments.description")}
        title={t("analysis.appointments.title")}
      >
        <StatCard
          label={t("analysis.appointments.thisWeek")}
          value={n(data?.appointments.thisWeek)}
        />
        <StatCard
          label={t("analysis.appointments.upcoming")}
          value={n(data?.appointments.upcoming)}
        />
        <StatCard
          label={t("analysis.appointments.completed")}
          value={n(data?.appointments.completed)}
        />
        <StatCard
          label={t("analysis.appointments.cancelled")}
          value={n(data?.appointments.cancelled)}
        />
      </Section>

      <Section
        description={t("analysis.prescriptions.description")}
        title={t("analysis.prescriptions.title")}
      >
        <StatCard
          label={t("analysis.prescriptions.total")}
          value={n(data?.prescriptions.total)}
        />
        <StatCard
          label={t("analysis.prescriptions.active")}
          value={n(data?.prescriptions.active)}
        />
      </Section>

      <Section
        description={t("analysis.tasks.description")}
        title={t("analysis.tasks.title")}
      >
        <StatCard label={t("analysis.tasks.open")} value={n(data?.tasks.open)} />
        <StatCard
          label={t("analysis.tasks.completed")}
          value={n(data?.tasks.done)}
        />
      </Section>
    </div>
  );
}
