"use client";

import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Parse a `YYYY-MM-DD` string as a LOCAL date. `new Date("YYYY-MM-DD")` parses
// as UTC and can shift the day across timezones, so build it from parts.
function parseISODate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DatePickerProps {
  /** Selected date as `YYYY-MM-DD` (matches native date-input semantics). */
  value?: string;
  onChange: (value: string) => void;
  /** Earliest selectable date, `YYYY-MM-DD`. */
  min?: string;
  /** Latest selectable date, `YYYY-MM-DD`. */
  max?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

// A COSS date picker: an outline Button trigger opening a Popover with the COSS
// Calendar. Drop-in replacement for `<input type="date">`, keeping the same
// string value shape so callers don't change their state handling.
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  id,
  className,
  disabled,
}: DatePickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);

  const disabledMatchers: Matcher[] = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
            disabled={disabled}
            id={id}
            variant="outline"
          />
        }
      >
        {selected ? selected.toLocaleDateString() : (placeholder ?? "")}
        <CalendarIcon className="opacity-80" />
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-auto">
        <Calendar
          autoFocus
          defaultMonth={selected ?? minDate}
          disabled={disabledMatchers.length ? disabledMatchers : undefined}
          mode="single"
          onSelect={(date?: Date) => {
            onChange(date ? toISODate(date) : "");
            if (date) setOpen(false);
          }}
          selected={selected}
        />
      </PopoverPopup>
    </Popover>
  );
}
