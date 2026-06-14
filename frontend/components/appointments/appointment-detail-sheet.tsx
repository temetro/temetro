"use client";

import { CalendarDays, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type Appointment,
  type AppointmentStatus,
  deleteAppointment,
  updateAppointment,
} from "@/lib/appointments";
import { listProviders, type Provider } from "@/lib/staff";
import { notify } from "@/lib/toast";

const TYPES = [
  "Follow-up",
  "New patient",
  "Consultation",
  "Lab review",
  "Vaccination",
];

const STATUSES: AppointmentStatus[] = [
  "confirmed",
  "checked-in",
  "completed",
  "cancelled",
];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

// Local-date ISO key (avoids UTC drift from toISOString).
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// Right-side Sheet for reviewing and editing a single appointment — opened by
// clicking a row in the schedule. Editing here is intentional (AI-drafted rows
// often need their placeholders filled in). Persists via the appointments API.
export function AppointmentDetailSheet({
  appt,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  appt: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Appointment) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [date, setDate] = useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState(TYPES[0]);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("confirmed");
  const [busy, setBusy] = useState(false);

  // Seed the form from the selected appointment whenever it changes.
  useEffect(() => {
    if (!appt) return;
    setDate(new Date(`${appt.date}T00:00:00`));
    setTime(appt.time);
    setType(appt.type);
    setProvider(appt.provider);
    setStatus(appt.status);
  }, [appt]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listProviders()
      .then((data) => active && setProviders(data))
      .catch(() => {
        /* provider combobox just stays empty; free-text is preserved */
      });
    return () => {
      active = false;
    };
  }, [open]);

  const providerOptions = useMemo<ComboboxOption[]>(
    () =>
      providers.map((pr) => ({
        value: pr.name,
        label: pr.name,
        keywords: pr.role,
      })),
    [providers],
  );

  const save = async () => {
    if (!appt) return;
    setBusy(true);
    try {
      const updated = await updateAppointment(appt.id, {
        fileNumber: appt.fileNumber,
        name: appt.name,
        initials: appt.initials,
        date: keyOf(date),
        time,
        type,
        provider,
        status,
      });
      onSaved(updated);
      notify.success(
        t("appointments.sheet.savedTitle"),
        t("appointments.sheet.savedBody"),
      );
      onOpenChange(false);
    } catch {
      notify.error(
        t("appointments.sheet.saveFailedTitle"),
        t("appointments.sheet.saveFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!appt) return;
    setBusy(true);
    try {
      await deleteAppointment(appt.id);
      onDeleted(appt.id);
      notify.success(t("appointments.sheet.deletedTitle"), appt.name);
      onOpenChange(false);
    } catch {
      notify.error(
        t("appointments.sheet.deleteFailedTitle"),
        t("appointments.sheet.deleteFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {appt?.name ?? t("appointments.sheet.title")}
            <AiBadge source={appt?.source} />
          </SheetTitle>
          <p className="text-muted-foreground text-xs">
            {t("appointments.sheet.editHint")}
          </p>
        </SheetHeader>

        <SheetPanel className="min-h-0 flex-1">
          {appt && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback>{appt.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {appt.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("appointments.dialog.fileNumber", {
                      number: appt.fileNumber || "—",
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">
                    {t("appointments.sheet.date")}
                  </span>
                  <Popover onOpenChange={setDateOpen} open={dateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          className="w-full justify-start font-normal"
                          type="button"
                          variant="outline"
                        >
                          <CalendarDays className="size-4" />
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Button>
                      }
                    />
                    <PopoverPopup>
                      <Calendar
                        mode="single"
                        onSelect={(d) => {
                          if (d) {
                            setDate(d);
                            setDateOpen(false);
                          }
                        }}
                        selected={date}
                      />
                    </PopoverPopup>
                  </Popover>
                </div>
                <Field label={t("appointments.sheet.time")}>
                  <Input
                    onChange={(event) => setTime(event.target.value)}
                    type="time"
                    value={time}
                  />
                </Field>
              </div>

              <Field label={t("appointments.sheet.type")}>
                <select
                  className={controlClass}
                  onChange={(event) => setType(event.target.value)}
                  value={TYPES.includes(type) ? type : ""}
                >
                  {/* Preserve a non-standard / placeholder type as an option. */}
                  {!TYPES.includes(type) && <option value="">{type}</option>}
                  {TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("appointments.sheet.provider")}>
                <Combobox
                  emptyText={t("appointments.dialog.noProviders")}
                  onSelect={setProvider}
                  onValueChange={setProvider}
                  options={providerOptions}
                  placeholder={t("appointments.dialog.providerPlaceholder")}
                  value={provider}
                />
              </Field>

              <Field label={t("appointments.sheet.status")}>
                <select
                  className={controlClass}
                  onChange={(event) =>
                    setStatus(event.target.value as AppointmentStatus)
                  }
                  value={status}
                >
                  {STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {t(`appointments.status.${option}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </SheetPanel>

        <SheetFooter className="flex-row justify-between">
          <Button
            disabled={busy}
            onClick={remove}
            type="button"
            variant="destructive"
          >
            <Trash2 className="size-4" />
            {t("appointments.sheet.delete")}
          </Button>
          <Button disabled={busy} onClick={save} type="button">
            {busy ? t("appointments.sheet.saving") : t("appointments.sheet.save")}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
