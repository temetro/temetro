"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { EarningsPoint } from "@/lib/analytics";

// Earnings by month — billed vs paid — drawn with the project's Bklit chart
// components (the vendored visx chart family under components/charts). Shared by
// the Analysis page and the chat analytics card.
export function EarningsChart({
  data,
  aspectRatio = "2 / 1",
}: {
  data: EarningsPoint[];
  aspectRatio?: string;
}) {
  const chartData = data.map((d) => ({
    name: d.label,
    billed: d.billed,
    paid: d.paid,
  }));
  return (
    <BarChart aspectRatio={aspectRatio} data={chartData}>
      <Grid horizontal />
      <Bar dataKey="billed" fill="var(--chart-line-primary)" />
      <Bar dataKey="paid" fill="var(--chart-2)" />
      <BarXAxis />
      <ChartTooltip showDatePill={false} />
    </BarChart>
  );
}
