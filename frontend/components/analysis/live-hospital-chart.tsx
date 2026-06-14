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
import { getLiveMetric } from "@/lib/analytics";

// The "Live" panel plots a REAL clinic signal — patients checked in today — by
// polling GET /api/analytics/live. It only runs while the clinician toggles it
// on, so the Analysis page stays idle by default. The metric changes slowly
// (only as people check in), so the line scrolls smoothly using the last value
// and refreshes from the server every few seconds.
const WINDOW_SECONDS = 30;
const REFETCH_EVERY_TICKS = 5; // poll the server every 5s (1s render ticks)

export function LiveHospitalChart() {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [data, setData] = useState<LiveLinePoint[]>([]);
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (!live) return;
    let active = true;

    const refetch = () =>
      getLiveMetric()
        .then((r) => {
          if (!active) return;
          valueRef.current = r.value;
          setValue(r.value);
        })
        .catch(() => {
          /* keep the last value on a transient error */
        });

    // Seed a short flat history from the first reading so the line draws at once.
    refetch().finally(() => {
      if (!active) return;
      const now = Date.now() / 1000;
      setData(
        Array.from({ length: WINDOW_SECONDS }, (_, i) => ({
          time: now - (WINDOW_SECONDS - i),
          value: valueRef.current,
        })),
      );
    });

    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      if (tick % REFETCH_EVERY_TICKS === 0) void refetch();
      setData((prev) => [
        ...prev.slice(-500),
        { time: Date.now() / 1000, value: valueRef.current },
      ]);
    }, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
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
            margin={{ left: 52, right: 48 }}
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
