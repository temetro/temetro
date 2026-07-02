"use client";

import { useState } from "react";

import { Sparkline } from "@/components/chat/sparkline";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrendPoint } from "@/lib/analytics";

// A KPI card with an inline line chart (Sparkline). Clicking it opens a dialog
// with the full line chart and a per-point breakdown. Used on the Analysis page.
export function TrendCard({
  title,
  description,
  points,
  emptyLabel,
  detailsLabel,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
  emptyLabel: string;
  detailsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const values = points.map((p) => p.count);
  const total = values.reduce((a, b) => a + b, 0);
  const hasData = points.length > 0;

  return (
    <>
      <button
        className="w-full text-start"
        disabled={!hasData}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Card className="gap-3 p-4 transition-colors hover:border-ring/40 hover:bg-accent/30">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-sm">{title}</span>
            <span className="font-semibold text-foreground text-xl tabular-nums">
              {total}
            </span>
          </div>
          {hasData ? (
            <Sparkline className="h-12" points={values} />
          ) : (
            <p className="py-4 text-center text-muted-foreground text-xs">
              {emptyLabel}
            </p>
          )}
          {hasData && (
            <span className="text-muted-foreground text-xs">{detailsLabel}</span>
          )}
        </Card>
      </button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-5">
            <Sparkline className="h-36" points={values} />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {points.map((p) => (
                <div
                  className="flex items-center justify-between border-border/60 border-b py-1"
                  key={p.label}
                >
                  <dt className="text-muted-foreground">{p.label}</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {p.count}
                  </dd>
                </div>
              ))}
            </dl>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
