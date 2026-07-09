"use client";

import { CalendarDays } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { TODAY } from "@/components/appointments/appointments-view";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { listPatients, type Patient } from "@/lib/patients";
import { listProviders, type Provider } from "@/lib/staff";
import { notify } from "@/lib/toast";
import { useWalletSync } from "@/components/wallet/use-wallet-sync";
import {
  DialogStepper,
  WalletSyncStep,
} from "@/components/wallet/wallet-sync-step";

export type NewAppointment = {
  fileNumber: string;
  name: string;
  initials: string;
  date: string; // ISO YYYY-MM-DD
  time: string;
  type: string;
  provider: string;
};

// Local-date ISO key (avoids UTC drift from toISOString).
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const TYPES = [
  "Follow-up",
  "New patient",
  "Consultation",
  "Lab review",
  "Vaccination",
];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

// Local start-of-day so the calendar can disable days strictly before today
// (appointments can't be scheduled in the past).
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// Compact "New appointment" dialog. The patient and provider are chosen via
// searchable comboboxes (arrow keys + Enter); the rest is the slot. The new
// entry is handed back to the page via onAdd, which persists it through the API.
export function AddAppointmentDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (appt: NewAppointment) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [date, setDate] = useState<Date>(() => new Date(`${TODAY}T00:00:00`));
  const [dateOpen, setDateOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState(TYPES[0]);
  const [provider, setProvider] = useState("");
  const [providerQuery, setProviderQuery] = useState("");
  const [step, setStep] = useState<"form" | "wallet">("form");
  const [walletSummary, setWalletSummary] = useState("");

  const sync = useWalletSync(selected?.fileNumber ?? null);

  // Load patients + providers lazily when the dialog opens (for the searches).
  useEffect(() => {
    if (!open) return;
    let active = true;
    listPatients()
      .then((data) => active && setPatients(data))
      .catch(() => {
        /* search just stays empty */
      });
    listProviders()
      .then((data) => active && setProviders(data))
      .catch(() => {
        /* falls back to the patient's PCP on submit */
      });
    return () => {
      active = false;
    };
  }, [open]);

  const patientOptions = useMemo<ComboboxOption[]>(
    () =>
      patients.map((p) => ({
        value: p.fileNumber,
        // Fold the file number into the label so it's type-to-searchable.
        label: `${p.name} ${p.fileNumber}`,
        node: (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              #{p.fileNumber}
            </span>
          </span>
        ),
      })),
    [patients],
  );

  const providerOptions = useMemo<ComboboxOption[]>(
    () =>
      providers.map((pr) => ({
        value: pr.name,
        label: pr.name,
        node: (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{pr.name}</span>
            <span className="shrink-0 text-muted-foreground text-xs capitalize">
              {pr.role}
            </span>
          </span>
        ),
      })),
    [providers],
  );

  const reset = () => {
    setSelected(null);
    setDate(new Date(`${TODAY}T00:00:00`));
    setDateOpen(false);
    setTime("09:00");
    setType(TYPES[0]);
    setProvider("");
    setProviderQuery("");
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      reset();
      setStep("form");
      sync.reset();
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) {
      notify.error(
        t("appointments.dialog.pickPatientTitle"),
        t("appointments.dialog.pickPatientBody"),
      );
      return;
    }
    await onAdd({
      fileNumber: selected.fileNumber,
      name: selected.name,
      initials: selected.initials,
      date: keyOf(date),
      time,
      type,
      provider: provider.trim() || selected.pcp,
    });
    notify.success(
      t("appointments.dialog.addedTitle"),
      `${selected.name} · ${time}`,
    );
    if (sync.linked) {
      setWalletSummary(
        t("walletSync.summary.appointment", { date: keyOf(date), time }),
      );
      setStep("wallet");
    } else {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="flex max-h-[85dvh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("appointments.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("appointments.dialog.description")}
          </DialogDescription>
          {sync.linked && <DialogStepper step={step} />}
        </DialogHeader>

        {step === "wallet" ? (
          <WalletSyncStep
            onDone={() => handleOpenChange(false)}
            patientName={selected?.name ?? ""}
            summary={walletSummary}
            sync={sync}
          />
        ) : (
        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label={t("appointments.dialog.patient")}>
              {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border bg-input/30 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {selected.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("appointments.dialog.fileNumber", {
                        number: selected.fileNumber,
                      })}
                    </span>
                  </div>
                  <Button
                    onClick={() => setSelected(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("appointments.dialog.change")}
                  </Button>
                </div>
              ) : (
                <Combobox
                  autoFocus
                  emptyText={t("appointments.dialog.noPatients")}
                  onSelect={(fileNumber) => {
                    const p = patients.find((x) => x.fileNumber === fileNumber);
                    if (p) setSelected(p);
                  }}
                  options={patientOptions}
                  placeholder={t("appointments.dialog.searchPlaceholder")}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {t("appointments.dialog.date")}
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
                      disabled={{ before: startOfToday() }}
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
              <Field label={t("appointments.dialog.time")}>
                <Input
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("appointments.dialog.type")}>
                <select
                  className={controlClass}
                  onChange={(event) => setType(event.target.value)}
                  value={type}
                >
                  {TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("appointments.dialog.provider")}>
                <Combobox
                  emptyText={t("appointments.dialog.noProviders")}
                  onSelect={(name) => {
                    setProvider(name);
                    setProviderQuery(name);
                  }}
                  onValueChange={setProviderQuery}
                  options={providerOptions}
                  placeholder={t("appointments.dialog.providerPlaceholder")}
                  value={providerQuery}
                />
              </Field>
            </div>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("appointments.dialog.cancel")}
            </DialogClose>
            <Button disabled={!selected} type="submit">
              {t("appointments.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
