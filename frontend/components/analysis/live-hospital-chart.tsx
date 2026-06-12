"use client";

import { useEffect, useRef, useState } from "react";

import {
  LiveLineChart,
  type LiveLinePoint,
} from "@/components/charts/live-line-chart";
import { LiveLine } from "@/components/charts/live-line";
import { LiveYAxis } from "@/components/charts/live-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";

// temetro has no real-time telemetry feed yet, so the "Live" panel simulates a
// hospital signal (patients currently in the building) as a bounded random walk
// that updates once a second. Swap `tick()` for a WebSocket/poll when a real
// feed exists — the chart contract (append { time, value }) stays the same.
const BASELINE = 48;
const MIN = 24;
const MAX = 90;
const WINDOW_SECONDS = 30;

export function LiveHospitalChart() {
  const [data, setData] = useState<LiveLinePoint[]>([]);
  const [value, setValue] = useState(BASELINE);
  const valueRef = useRef(BASELINE);

  useEffect(() => {
    // Seed a short history so the line is drawn immediately on mount.
    const now = Date.now() / 1000;
    setData(
      Array.from({ length: WINDOW_SECONDS }, (_, i) => ({
        time: now - (WINDOW_SECONDS - i),
        value: BASELINE,
      })),
    );

    const id = setInterval(() => {
      const drift = (Math.random() - 0.5) * 5;
      const next = Math.max(MIN, Math.min(MAX, valueRef.current + drift));
      valueRef.current = next;
      setValue(next);
      setData((prev) => [
        ...prev.slice(-500),
        { time: Date.now() / 1000, value: next },
      ]);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-56 w-full">
      <LiveLineChart data={data} value={value} window={WINDOW_SECONDS}>
        <LiveLine
          dataKey="value"
          formatValue={(v) => String(Math.round(v))}
          momentumColors={{
            up: "var(--color-emerald-500)",
            down: "var(--color-red-500)",
            flat: "var(--chart-line-primary)",
          }}
        />
        <LiveYAxis formatValue={(v) => String(Math.round(v))} position="left" />
        <ChartTooltip showDatePill={false} />
      </LiveLineChart>
    </div>
  );
}
