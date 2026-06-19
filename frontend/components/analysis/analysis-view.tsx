"use client";

import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { EarningsChart } from "@/components/analysis/earnings-chart";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { type Analytics, getAnalytics } from "@/lib/analytics";
import { type Appointment, listAppointments } from "@/lib/appointments";
import { formatMoney } from "@/lib/invoices";
import { cn } from "@/lib/utils";

// Time-range filter for the Overview header. Month-based series are sliced to
// the trailing window; sub-month ranges (30d/today) fall back to the latest
// point since the backend has no finer-grained series yet.
const RANGES = ["all", "12m", "3m", "30d", "today"] as const;
type Range = (typeof RANGES)[number];
const RANGE_MONTHS: Record<Range, number | null> = {
  all: null,
  "12m": 12,
  "3m": 3,
  "30d": 1,
  today: 1,
};
function sliceMonths<T>(arr: T[], range: Range): T[] {
  const months = RANGE_MONTHS[range];
  return months == null ? arr : arr.slice(-months);
}

// The Overview sections the Customize popover can show/hide.
const SECTION_KEYS = [
  "visits",
  "patients",
  "trends",
  "earnings",
  "appointments",
  "prescriptions",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [visible, setVisible] = useState<Record<SectionKey, boolean>>({
    visits: true,
    patients: true,
    trends: true,
    earnings: true,
    appointments: true,
    prescriptions: true,
  });

  useEffect(() => {
    let active = true;
    getAnalytics()
      .then((a) => {
        if (active) setData(a);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave it loading */
      });
    listAppointments()
      .then((a) => {
        if (active) setAppointments(a);
      })
      .catch(() => {
        /* leave the visits chart empty on failure */
      });
    return () => {
      active = false;
    };
  }, []);

  const n = (v: number | undefined) => String(v ?? 0);

  // Patient visits per month over the last six months, aggregated from real
  // appointments (no server-side monthly series exists yet).
  const visitData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => ({
      date: new Date(now.getFullYear(), now.getMonth() - (5 - i), 1),
      visits: 0,
    }));
    for (const a of appointments) {
      const d = new Date(`${a.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const m = months.find(
        (mo) =>
          mo.date.getFullYear() === d.getFullYear() &&
          mo.date.getMonth() === d.getMonth(),
      );
      if (m) m.visits += 1;
    }
    return months;
  }, [appointments]);
  const visitDataRanged = useMemo(
    () => sliceMonths(visitData, range),
    [visitData, range],
  );
  const visitTotal = visitDataRanged.reduce((sum, p) => sum + p.visits, 0);

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

  const monthDataRanged = useMemo(
    () => sliceMonths(monthData, range),
    [monthData, range],
  );
  const earningsByMonthRanged = sliceMonths(
    data?.earnings.byMonth ?? [],
    range,
  );
  const monthTotal = monthDataRanged.reduce((sum, p) => sum + p.patients, 0);
  const weekdayTotal = weekdayData.reduce((sum, p) => sum + p.appointments, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      {/* Overview header: title + time-range segmented control + Customize. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("analysis.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("analysis.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 p-1">
            {RANGES.map((r) => (
              <button
                className={cn(
                  "rounded-full px-3 py-1 font-medium text-sm transition-colors",
                  range === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={r}
                onClick={() => setRange(r)}
                type="button"
              >
                {t(`analysis.range.${r}`)}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button size="sm" variant="outline">
                  <SlidersHorizontal className="size-4" />
                  {t("analysis.customize")}
                </Button>
              }
            />
            <PopoverPopup className="w-56">
              <p className="mb-2 font-medium text-sm">
                {t("analysis.customizeTitle")}
              </p>
              <div className="flex flex-col gap-2">
                {SECTION_KEYS.map((key) => (
                  <label
                    className="flex items-center justify-between gap-3 text-sm"
                    key={key}
                  >
                    <span className="text-muted-foreground">
                      {t(`analysis.section.${key}`)}
                    </span>
                    <Switch
                      checked={visible[key]}
                      onCheckedChange={(checked) =>
                        setVisible((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </label>
                ))}
              </div>
            </PopoverPopup>
          </Popover>
        </div>
      </div>

      {visible.visits && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-lg tracking-tight">
              {t("analysis.area.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("analysis.area.subtitle")}
            </p>
          </div>
          <Card className="gap-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {t("analysis.area.label")}
              </span>
              <span className="font-semibold text-foreground text-xl tabular-nums">
                {visitTotal}
              </span>
            </div>
            <AreaChart aspectRatio="3 / 1" data={visitDataRanged}>
              <Grid horizontal />
              <Area dataKey="visits" fill="var(--chart-line-primary)" />
              <XAxis
                numTicks={Math.max(visitDataRanged.length, 2)}
                tickMode="data"
              />
              <ChartTooltip showDatePill={false} />
            </AreaChart>
          </Card>
        </section>
      )}

      {visible.patients && (
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
      )}

      {visible.trends && (
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
              <AreaChart aspectRatio="2 / 1" data={monthDataRanged}>
                <Grid horizontal />
                <Area dataKey="patients" fill="var(--chart-line-primary)" />
                {/* One tick per month so every point is labelled. */}
                <XAxis
                  numTicks={Math.max(monthDataRanged.length, 2)}
                  tickMode="data"
                />
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
      )}

      {visible.earnings && (
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("analysis.earnings.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("analysis.earnings.description")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("analysis.earnings.billed")}
            value={formatMoney(data?.earnings.totalBilled ?? 0)}
          />
          <StatCard
            label={t("analysis.earnings.paid")}
            value={formatMoney(data?.earnings.totalPaid ?? 0)}
          />
          <StatCard
            label={t("analysis.earnings.outstanding")}
            value={formatMoney(data?.earnings.totalOutstanding ?? 0)}
          />
        </div>
        <Card className="gap-3 p-4">
          <span className="text-muted-foreground text-sm">
            {t("analysis.earnings.byMonth")}
          </span>
          <EarningsChart data={earningsByMonthRanged} />
        </Card>
      </section>
      )}

      {visible.appointments && (
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
      )}

      {visible.prescriptions && (
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
      )}

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
