"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { LiveHospitalChart } from "@/components/analysis/live-hospital-chart";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
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

// Each section's grid fills its row evenly: the column count matches the number
// of cards so there's never an orphan card on its own row. Static class strings
// (no interpolation) so Tailwind can see them.
const GRID_BY_COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid grid-cols-1 gap-4 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
};

function Section({
  title,
  description,
  columns,
  children,
}: {
  title: string;
  description: string;
  columns: 2 | 3 | 4;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className={GRID_BY_COLUMNS[columns]}>{children}</div>
    </section>
  );
}

// A titled card that frames a chart, used for the trend visualisations.
function ChartCard({
  title,
  total,
  children,
}: {
  title: string;
  total: number;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-sm">{title}</span>
        <span className="font-semibold text-foreground text-xl tabular-nums">
          {total}
        </span>
      </div>
      {children}
    </Card>
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

  // The area chart needs real Date x-values: synthesise one month per point,
  // ending with the current month.
  const monthData = useMemo(() => {
    const points = data?.trends.patientsByMonth ?? [];
    const now = new Date();
    return points.map((p, i) => ({
      date: new Date(
        now.getFullYear(),
        now.getMonth() - (points.length - 1 - i),
        1,
      ),
      patients: p.count,
    }));
  }, [data]);

  // The bar chart is categorical (one bar per weekday).
  const weekdayData = useMemo(
    () =>
      (data?.trends.appointmentsByWeekday ?? []).map((p) => ({
        name: p.label,
        appointments: p.count,
      })),
    [data],
  );

  const monthTotal = monthData.reduce((sum, p) => sum + p.patients, 0);
  const weekdayTotal = weekdayData.reduce((sum, p) => sum + p.appointments, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("analysis.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("analysis.subtitle")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("analysis.live.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("analysis.live.subtitle")}
          </p>
        </div>
        <Card className="gap-3 p-4">
          <span className="text-muted-foreground text-sm">
            {t("analysis.live.label")}
          </span>
          <LiveHospitalChart />
        </Card>
      </section>

      <Section
        columns={3}
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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("analysis.charts.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("analysis.charts.subtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChartCard
            title={t("analysis.charts.patientGrowthTitle")}
            total={monthTotal}
          >
            <AreaChart aspectRatio="2 / 1" data={monthData}>
              <Grid horizontal />
              <Area dataKey="patients" fill="var(--chart-line-primary)" />
              {/* One tick per month so every point is labelled. */}
              <XAxis numTicks={Math.max(monthData.length, 2)} tickMode="data" />
              <ChartTooltip showDatePill={false} />
            </AreaChart>
          </ChartCard>
          <ChartCard
            title={t("analysis.charts.weeklyAppointmentsTitle")}
            total={weekdayTotal}
          >
            <BarChart aspectRatio="2 / 1" data={weekdayData}>
              <Grid horizontal />
              <Bar dataKey="appointments" fill="var(--chart-line-primary)" />
              {/* Vertical bars: weekdays live on the x-axis only. (A BarYAxis
                  here printed the categories down the left, overflowing the card.) */}
              <BarXAxis />
              <ChartTooltip showDatePill={false} />
            </BarChart>
          </ChartCard>
        </div>
      </section>

      <Section
        columns={4}
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
        columns={2}
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
        columns={2}
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
