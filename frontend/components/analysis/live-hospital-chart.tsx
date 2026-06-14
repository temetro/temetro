"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  LiveLineChart,
  type LiveLinePoint,
} from "@/components/charts/live-line-chart";
import { LiveLine } from "@/components/charts/live-line";
import { LiveYAxis } from "@/components/charts/live-y-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Button } from "@/components/ui/button";

// temetro has no real-time telemetry feed yet, so the "Live" panel simulates a
// hospital signal (patients currently in the building) as a bounded random walk
// that updates once a second. Swap `tick()` for a WebSocket/poll when a real
// feed exists — the chart contract (append { time, value }) stays the same.
//
// The simulation (a 1s interval + an rAF animation loop) only runs while the
// clinician has explicitly toggled it on, so the Analysis page stays idle by
// default instead of animating in the background.
const BASELINE = 48;
const MIN = 24;
const MAX = 90;
const WINDOW_SECONDS = 30;

export function LiveHospitalChart() {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [data, setData] = useState<LiveLinePoint[]>([]);
  const [value, setValue] = useState(BASELINE);
  const valueRef = useRef(BASELINE);

  useEffect(() => {
    if (!live) return;
    // Seed a short history so the line is drawn immediately on start.
    const now = Date.now() / 1000;
    valueRef.current = BASELINE;
    setValue(BASELINE);
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
  }, [live]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setLive((v) => !v)}
          size="sm"
          type="button"
          variant={live ? "outline" : "default"}
        >
          {live ? (
            <>
              <Pause className="size-4" />
              {t("analysis.live.pause")}
            </>
          ) : (
            <>
              <Play className="size-4" />
              {t("analysis.live.start")}
            </>
          )}
        </Button>
      </div>

      {live ? (
        <div className="h-56 w-full">
          <LiveLineChart
            data={data}
            margin={{ left: 44 }}
            value={value}
            window={WINDOW_SECONDS}
          >
            <LiveLine
              dataKey="value"
              formatValue={(v) => String(Math.round(v))}
              momentumColors={{
                up: "var(--color-emerald-500)",
                down: "var(--color-red-500)",
                flat: "var(--chart-line-primary)",
              }}
            />
            <LiveYAxis
              formatValue={(v) => String(Math.round(v))}
              position="left"
            />
            <ChartTooltip showDatePill={false} />
          </LiveLineChart>
        </div>
      ) : (
        <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-dashed bg-card/20 text-center text-muted-foreground text-sm">
          {t("analysis.live.idle")}
        </div>
      )}
    </div>
  );
}
