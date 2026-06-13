"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Area, AreaChart } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LabCardData } from "@/lib/ai-chat";
import type { LabFlag } from "@/lib/patients";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const labFlagVariant: Record<LabFlag, BadgeVariant> = {
  normal: "outline",
  low: "secondary",
  high: "secondary",
  critical: "destructive",
};

// Plot the headline lab series. labTrend.points are most-recent-last numbers; we
// synthesise evenly spaced dates ending today purely so the date x-axis spaces
// the readings — the values are what matter.
function toChartData(points: number[]): { date: Date; value: number }[] {
  const today = new Date();
  return points.map((value, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (points.length - 1 - i));
    return { date, value };
  });
}

// The flag of the most recent reading of the headline lab, for the corner badge.
function headlineFlag(data: LabCardData): LabFlag | null {
  const matching = data.labs.filter((l) => l.name === data.labTrend.label);
  const last = matching[matching.length - 1] ?? data.labs[data.labs.length - 1];
  return last?.flag ?? null;
}

export function LabChartCard({ data }: { data: LabCardData }) {
  const { t } = useTranslation();
  const chartData = useMemo(
    () => toChartData(data.labTrend.points),
    [data.labTrend.points],
  );
  const flag = headlineFlag(data);
  const latest = data.labTrend.points[data.labTrend.points.length - 1];

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-sm font-medium text-foreground">
            {data.name}
          </span>
          <p className="text-xs text-muted-foreground">
            {data.labTrend.label} · {data.labTrend.unit}
          </p>
        </div>
        {/* High/low indicator, top-right corner. */}
        {flag && flag !== "normal" ? (
          <Badge className="gap-1" variant={labFlagVariant[flag]}>
            {flag === "low" ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUp className="size-3" />
            )}
            {t(`chat.labCard.flags.${flag}`)}
          </Badge>
        ) : (
          <span className="font-semibold text-foreground tabular-nums">
            {latest}
          </span>
        )}
      </div>

      <AreaChart aspectRatio="2 / 1" data={chartData}>
        <Grid horizontal />
        <Area dataKey="value" fill="var(--chart-line-primary)" />
        <XAxis tickMode="data" />
        <ChartTooltip showDatePill={false} />
      </AreaChart>

      {data.labs.length > 0 ? (
        <ul className="space-y-1.5">
          {data.labs.slice(-6).map((lab, i) => (
            <li
              className="flex items-center justify-between gap-2 text-sm"
              key={`${lab.name}-${i}`}
            >
              <span className="text-muted-foreground">{lab.name}</span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "tabular-nums",
                    lab.flag === "critical"
                      ? "text-destructive-foreground"
                      : "text-foreground",
                  )}
                >
                  {lab.value}
                </span>
                {lab.flag !== "normal" ? (
                  <Badge
                    className="px-1.5 py-0 text-[11px]"
                    variant={labFlagVariant[lab.flag]}
                  >
                    {t(`chat.labCard.flags.${lab.flag}`)}
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
