"use client";

import { type MouseEvent, useId, useState } from "react";

import { cn } from "@/lib/utils";

// A tiny dependency-free trend chart: a line with a soft shaded fill beneath it.
// Stretches to its container width; colored via `currentColor` (default text-primary).
// Moving the cursor over it reveals the value at the nearest reading.
export function Sparkline({
  points,
  unit,
  className,
}: {
  points: number[];
  unit?: string;
  className?: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) {
    return null;
  }

  const width = 100;
  const top = 3;
  const bottom = 29;
  const viewHeight = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;

  const coords = points.map((value, index) => {
    const x =
      points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y =
      range === 0
        ? (top + bottom) / 2
        : bottom - ((value - min) / range) * (bottom - top);
    return { value, x, y, xPct: x, yPct: (y / viewHeight) * 100 };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${viewHeight} L0,${viewHeight} Z`;

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  const point = active === null ? null : coords[active];

  return (
    <div
      className={cn("relative h-10 w-full text-primary", className)}
      onMouseLeave={() => setActive(null)}
      onMouseMove={handleMove}
    >
      <svg
        aria-hidden="true"
        className="size-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${viewHeight}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {point && (
        <>
          <span
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-popover"
            style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
          />
          <span
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-md bg-popover px-1.5 py-0.5 text-xs whitespace-nowrap text-popover-foreground shadow ring-1 ring-foreground/10"
            style={{
              left: `${Math.min(85, Math.max(15, point.xPct))}%`,
              top: `${point.yPct}%`,
            }}
          >
            <span className="text-foreground">{point.value}</span>
            {unit ? (
              <span className="text-muted-foreground"> {unit}</span>
            ) : null}
          </span>
        </>
      )}
    </div>
  );
}
