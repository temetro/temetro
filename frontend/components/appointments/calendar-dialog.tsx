"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type Appointment,
  ScheduleList,
  TODAY,
} from "@/components/appointments/appointments-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local-date ISO key, e.g. "2026-06-05" (avoids UTC drift from toISOString).
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const parseKey = (key: string) => new Date(`${key}T00:00:00`);

const formatDayKey = (key: string) =>
  parseKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const byTime = (a: Appointment, b: Appointment) => a.time.localeCompare(b.time);

// Event chip color by status, using semantic tokens.
const chipClass: Record<Appointment["status"], string> = {
  confirmed: "bg-secondary text-secondary-foreground",
  "checked-in": "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive line-through",
};

// A Google-Calendar-style month grid in a dialog: a 6×7 grid of day cells with
// color-coded event chips; navigate months and click a day to list its
// appointments. Reads the appointments passed down from the page.
export function CalendarDialog({
  open,
  onOpenChange,
  appointments,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: Appointment[];
  // Optional deep-link target (YYYY-MM-DD): when set, the calendar opens on this
  // date's month with the day selected (e.g. from the AI chat appointment card).
  initialDate?: string | null;
}) {
  const { t } = useTranslation();
  const startKey =
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : TODAY;
  // First-of-month for the displayed month; defaults to the deep-link/TODAY month.
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseKey(startKey);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState<string>(startKey);

  // When opened via a deep-link date, jump the view to that month/day. Adjusted
  // during render rather than in an effect, so the calendar never paints the
  // current month before jumping to the linked one.
  const jumpTo =
    open && initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? initialDate
      : null;
  const [prevJumpTo, setPrevJumpTo] = useState<string | null>(null);
  if (prevJumpTo !== jumpTo) {
    setPrevJumpTo(jumpTo);
    if (jumpTo) {
      const d = parseKey(jumpTo);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setSelectedKey(jumpTo);
    }
  }

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [appointments]);

  // 42 cells (6 weeks) starting from the Sunday on/before the 1st.
  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const start = new Date(
      first.getFullYear(),
      first.getMonth(),
      1 - first.getDay(),
    );
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    );
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedItems = (byDate.get(selectedKey) ?? []).slice().sort(byTime);

  const shiftMonth = (delta: number) =>
    setViewMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + delta, 1),
    );

  const goToday = () => {
    const t = parseKey(TODAY);
    setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedKey(TODAY);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pe-8">
            <DialogTitle>{monthLabel}</DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                onClick={goToday}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("appointments.calendarDialog.today")}
              </Button>
              <Button
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
              <Button
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <DialogPanel className="flex flex-col gap-4">
          <div>
            <div className="grid grid-cols-7 gap-1 pb-1">
              {WEEKDAYS.map((d) => (
                <div
                  className="px-1 text-center font-medium text-muted-foreground text-xs"
                  key={d}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date) => {
                const key = keyOf(date);
                const inMonth = date.getMonth() === viewMonth.getMonth();
                const isToday = key === TODAY;
                const isSelected = key === selectedKey;
                const items = (byDate.get(key) ?? []).slice().sort(byTime);
                return (
                  <button
                    className={cn(
                      "flex min-h-22 flex-col gap-1 rounded-lg border p-1.5 text-start align-top transition-colors hover:bg-accent/50",
                      inMonth
                        ? "bg-card/30"
                        : "bg-transparent text-muted-foreground/40",
                      isSelected && "ring-2 ring-primary",
                    )}
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {items.slice(0, 3).map((a) => (
                        <span
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                            chipClass[a.status],
                          )}
                          key={a.time + a.name}
                        >
                          {a.time} {a.name}
                        </span>
                      ))}
                      {items.length > 3 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{items.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <h3 className="font-medium text-foreground text-sm">
                {formatDayKey(selectedKey)}
              </h3>
              <p className="text-muted-foreground text-xs">
                {t("appointments.calendarDialog.appointmentCount", {
                  count: selectedItems.length,
                })}
              </p>
            </div>
            {selectedItems.length > 0 ? (
              <ScheduleList items={selectedItems} />
            ) : (
              <div className="rounded-2xl border border-dashed bg-card/20 px-4 py-8 text-center text-muted-foreground text-sm">
                {t("appointments.calendarDialog.none")}
              </div>
            )}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
