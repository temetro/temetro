"use client";

import { useState } from "react";

import {
  type Appointment,
  ScheduleList,
} from "@/components/appointments/appointments-view";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

// The mock schedule all belongs to this day (matches "Wednesday, June 5" in the
// Appointments view). Month is zero-based, so 5 = June.
const SCHEDULE_DATE = new Date(2026, 5, 5);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fullDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

// A month-grid calendar (à la Google Calendar) shown in a dialog. The day that
// owns the mock schedule is ringed; selecting it lists those appointments, while
// any other day shows an empty note. Mock-only — there's no per-date backend.
export function CalendarDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Appointment[];
}) {
  const [selected, setSelected] = useState<Date>(SCHEDULE_DATE);

  const dayItems = sameDay(selected, SCHEDULE_DATE) ? schedule : [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Calendar</DialogTitle>
          <DialogDescription>
            Browse the schedule by date. Sample data.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          <div className="flex justify-center sm:block">
            <Calendar
              className="rounded-2xl border bg-card/30 p-3"
              defaultMonth={SCHEDULE_DATE}
              mode="single"
              modifiers={{ scheduled: SCHEDULE_DATE }}
              modifiersClassNames={{
                scheduled: "[&_button]:ring-2 [&_button]:ring-primary",
              }}
              onSelect={(d) => d && setSelected(d)}
              selected={selected}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <h3 className="font-medium text-foreground text-sm">
                {fullDate(selected)}
              </h3>
              <p className="text-muted-foreground text-xs">
                {dayItems.length === 1
                  ? "1 appointment"
                  : `${dayItems.length} appointments`}
              </p>
            </div>
            {dayItems.length > 0 ? (
              <ScheduleList items={dayItems} />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed bg-card/20 px-4 py-10 text-center text-muted-foreground text-sm">
                No appointments on this day.
              </div>
            )}
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
