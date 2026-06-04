"use client";

import { Search } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { listPatients, type Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";

export type NewAppointment = {
  fileNumber: string;
  name: string;
  initials: string;
  time: string;
  type: string;
  provider: string;
};

const TYPES = [
  "Follow-up",
  "New patient",
  "Consultation",
  "Lab review",
  "Vaccination",
];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// Compact "New appointment" dialog. The patient is chosen via a quick search by
// name or file number; the rest is the slot. Appointments are mock-only, so a
// confirmed entry is handed back to the page via onAdd.
export function AddAppointmentDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (appt: NewAppointment) => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState(TYPES[0]);
  const [provider, setProvider] = useState("");

  // Load patients lazily when the dialog opens (for the quick search).
  useEffect(() => {
    if (!open) return;
    let active = true;
    listPatients()
      .then((data) => {
        if (active) setPatients(data);
      })
      .catch(() => {
        /* search just stays empty */
      });
    return () => {
      active = false;
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.fileNumber.includes(q),
      )
      .slice(0, 6);
  }, [patients, query]);

  const reset = () => {
    setQuery("");
    setSelected(null);
    setTime("09:00");
    setType(TYPES[0]);
    setProvider("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) {
      notify.error("Pick a patient", "Search and select a patient first.");
      return;
    }
    onAdd({
      fileNumber: selected.fileNumber,
      name: selected.name,
      initials: selected.initials,
      time,
      type,
      provider: provider.trim() || selected.pcp,
    });
    notify.success("Appointment added", `${selected.name} at ${time}`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      open={open}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
          <DialogDescription>
            Search for a patient by name or file number, then set the slot.
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label="Patient">
              {selected ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border bg-input/30 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {selected.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      File #{selected.fileNumber}
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setSelected(null);
                      setQuery("");
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      className="pl-9"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search name or file number"
                      value={query}
                    />
                  </div>
                  {query.trim() && (
                    <div className="max-h-56 overflow-y-auto rounded-2xl border bg-popover p-1">
                      {matches.length === 0 ? (
                        <p className="px-2 py-2 text-muted-foreground text-sm">
                          No patients found.
                        </p>
                      ) : (
                        matches.map((p) => (
                          <button
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                            key={p.fileNumber}
                            onClick={() => {
                              setSelected(p);
                              setQuery("");
                            }}
                            type="button"
                          >
                            <span className="truncate text-foreground text-sm">
                              {p.name}
                            </span>
                            <span className="shrink-0 text-muted-foreground text-xs">
                              #{p.fileNumber}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Time">
                <Input
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </Field>
              <Field label="Type">
                <select
                  className={controlClass}
                  onChange={(event) => setType(event.target.value)}
                  value={type}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Provider">
              <Input
                onChange={(event) => setProvider(event.target.value)}
                placeholder="e.g. Dr. Okafor"
                value={provider}
              />
            </Field>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!selected} type="submit">
              Add appointment
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
