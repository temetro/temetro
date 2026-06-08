"use client";

import type { TrendPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// A small dependency-free vertical bar chart (matches the spirit of
// components/chat/sparkline.tsx). Bars scale to the series max; each shows its
// value above and its label below. Themed with semantic tokens.
export function BarChart({
  data,
  className,
  emptyLabel,
}: {
  data: TrendPoint[];
  className?: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const hasData = data.some((d) => d.count > 0);

  if (data.length === 0 || !hasData) {
    return (
      <div
        className={cn(
          "flex h-44 items-center justify-center text-muted-foreground text-sm",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("flex h-44 items-end gap-2 sm:gap-3", className)}>
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        return (
          <div
            className="flex h-full flex-1 flex-col items-center gap-1.5"
            key={`${d.label}-${i}`}
          >
            <span className="font-medium text-foreground text-xs tabular-nums">
              {d.count}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md bg-primary/80 transition-colors hover:bg-primary"
                style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                title={`${d.label}: ${d.count}`}
              />
            </div>
            <span className="text-muted-foreground text-xs">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
