"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

// A tiny dependency-free trend chart: a line with a soft shaded fill beneath it.
// Stretches to its container width; colored via `currentColor` (default text-primary).
export function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  const gradientId = useId();

  if (points.length === 0) {
    return null;
  }

  const width = 100;
  const top = 3;
  const bottom = 29;
  const baseline = 32;
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
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c}`).join(" ");
  const area = `${line} L${width},${baseline} L0,${baseline} Z`;

  return (
    <svg
      aria-hidden="true"
      className={cn("h-10 w-full text-primary", className)}
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${baseline}`}
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
  );
}
