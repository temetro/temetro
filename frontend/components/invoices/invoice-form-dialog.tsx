"use client";

import { CalendarDays, Plus, X } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createInvoice,
  formatMoney,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceStatus,
  updateInvoice,
} from "@/lib/invoices";
import { listPatients, type Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";
import { useWalletSync } from "@/components/wallet/use-wallet-sync";
import {
  DialogStepper,
  WalletSyncStep,
} from "@/components/wallet/wallet-sync-step";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

function emptyLine(): InvoiceLineItem {
  return { description: "", quantity: 1, unitPrice: 0 };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

// Local start-of-day, used to disable days strictly before today.
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function DatePicker({
  value,
  onChange,
  allowPast = true,
}: {
  value: Date;
  onChange: (d: Date) => void;
  // When false, days before today are disabled (used for the issue date unless
  // the clinician opts into back-dating an older invoice).
  allowPast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-start font-normal"
            type="button"
            variant="outline"
          >
            <CalendarDays className="size-4" />
            {value.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Button>
        }
      />
      <PopoverPopup>
        <Calendar
          disabled={allowPast ? undefined : { before: startOfToday() }}
          mode="single"
          onSelect={(d) => {
            if (d) {
              onChange(d);
              setOpen(false);
            }
          }}
          selected={value}
        />
      </PopoverPopup>
    </Popover>
  );
}

// Create or edit an invoice. The patient is chosen with a searchable combobox on
// create (locked on edit); line items are edited inline and the total updates
// live. Persists through the invoices API and hands the saved record back.
export function InvoiceFormDialog({
  open,
  onOpenChange,
  mode,
  invoice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  invoice?: Invoice;
  onSaved: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  // In edit mode the patient is fixed; keep the denormalized identity.
  const fixedPatient =
    mode === "edit" && invoice
      ? {
          fileNumber: invoice.fileNumber,
          name: invoice.name,
          initials: invoice.initials,
        }
      : null;

  const [issuedAt, setIssuedAt] = useState<Date>(() => new Date());
  // Off by default: the issue date can't be back-dated unless the clinician
  // opts in (for recording an older, pre-existing invoice).
  const [allowBackdate, setAllowBackdate] = useState(false);
  const [hasDue, setHasDue] = useState(false);
  const [dueAt, setDueAt] = useState<Date>(() => new Date());
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "wallet">("form");
  const [walletSummary, setWalletSummary] = useState("");

  const activePatient = fixedPatient ?? selected;
  const sync = useWalletSync(activePatient?.fileNumber ?? null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep("form");
      sync.reset();
    }
    onOpenChange(next);
  };

  // Seed the form when opening.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && invoice) {
      setIssuedAt(new Date(`${invoice.issuedAt}T00:00:00`));
      // Existing invoices legitimately carry past issue dates.
      setAllowBackdate(true);
      setHasDue(Boolean(invoice.dueAt));
      setDueAt(new Date(`${invoice.dueAt ?? invoice.issuedAt}T00:00:00`));
      setStatus(invoice.status);
      setNotes(invoice.notes ?? "");
      setLineItems(
        invoice.lineItems.length ? invoice.lineItems : [emptyLine()],
      );
    } else {
      setSelected(null);
      setIssuedAt(new Date());
      setAllowBackdate(false);
      setHasDue(false);
      setDueAt(new Date());
      setStatus("draft");
      setNotes("");
      setLineItems([emptyLine()]);
    }
  }, [open, mode, invoice]);

  // Load patients lazily for the create combobox.
  useEffect(() => {
    if (!open || mode !== "create") return;
    let active = true;
    listPatients()
      .then((data) => active && setPatients(data))
      .catch(() => {
        /* search stays empty */
      });
    return () => {
      active = false;
    };
  }, [open, mode]);

  const patientOptions = useMemo<ComboboxOption[]>(
    () =>
      patients.map((p) => ({
        value: p.fileNumber,
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

  const total = useMemo(
    () =>
      lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0),
    [lineItems],
  );

  const updateLine = (index: number, patch: Partial<InvoiceLineItem>) =>
    setLineItems((prev) =>
      prev.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const patient = fixedPatient ?? selected;
    if (!patient) {
      notify.error(
        t("invoices.dialog.pickPatientTitle"),
        t("invoices.dialog.pickPatientBody"),
      );
      return;
    }
    const cleanLines = lineItems.filter((li) => li.description.trim());
    setBusy(true);
    try {
      const payload = {
        fileNumber: patient.fileNumber,
        name: patient.name,
        initials: patient.initials,
        issuedAt: keyOf(issuedAt),
        dueAt: hasDue ? keyOf(dueAt) : null,
        status,
        lineItems: cleanLines,
        notes: notes.trim() || null,
      };
      const saved =
        mode === "edit" && invoice
          ? await updateInvoice(invoice.id, {
              ...payload,
              // Preserve fields the form doesn't edit.
              number: invoice.number,
              installments: invoice.installments,
            })
          : await createInvoice(payload);
      onSaved(saved);
      if (sync.linked) {
        setWalletSummary(
          mode === "edit"
            ? t("walletSync.summary.invoiceUpdated", { number: saved.number })
            : t("walletSync.summary.invoiceCreated", { number: saved.number }),
        );
        setStep("wallet");
      } else {
        onOpenChange(false);
      }
    } catch {
      notify.error(t("invoices.addFailedTitle"), t("invoices.addFailedBody"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup className="flex max-h-[85dvh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? t("invoices.dialog.editTitle")
              : t("invoices.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("invoices.dialog.description")}
          </DialogDescription>
          {sync.linked && <DialogStepper step={step} />}
        </DialogHeader>

        {step === "wallet" ? (
          <WalletSyncStep
            onDone={() => handleOpenChange(false)}
            patientName={activePatient?.name ?? ""}
            summary={walletSummary}
            sync={sync}
          />
        ) : (
        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-4">
            <Field label={t("invoices.dialog.patient")}>
              {fixedPatient ? (
                <div className="rounded-2xl border bg-input/30 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">
                    {fixedPatient.name}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {t("invoices.dialog.fileNumber", {
                      number: fixedPatient.fileNumber || "—",
                    })}
                  </span>
                </div>
              ) : selected ? (
                <div className="flex items-center justify-between gap-2 rounded-2xl border bg-input/30 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {selected.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("invoices.dialog.fileNumber", {
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
                    {t("invoices.dialog.change")}
                  </Button>
                </div>
              ) : (
                <Combobox
                  autoFocus
                  emptyText={t("invoices.dialog.noPatients")}
                  onSelect={(fileNumber) => {
                    const p = patients.find((x) => x.fileNumber === fileNumber);
                    if (p) setSelected(p);
                  }}
                  options={patientOptions}
                  placeholder={t("invoices.dialog.searchPlaceholder")}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
                  {t("invoices.dialog.issued")}
                  <label
                    className="flex items-center gap-1.5 text-[11px]"
                    htmlFor="invoice-backdate"
                  >
                    <Checkbox
                      checked={allowBackdate}
                      id="invoice-backdate"
                      onCheckedChange={(checked) => setAllowBackdate(checked)}
                    />
                    {t("invoices.dialog.backdate")}
                  </label>
                </span>
                <DatePicker
                  allowPast={allowBackdate}
                  onChange={setIssuedAt}
                  value={issuedAt}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-muted-foreground text-xs">
                  {t("invoices.dialog.due")}
                  <Checkbox
                    aria-label={t("invoices.dialog.due")}
                    checked={hasDue}
                    onCheckedChange={(checked) => setHasDue(checked)}
                  />
                </span>
                {hasDue ? (
                  <DatePicker onChange={setDueAt} value={dueAt} />
                ) : (
                  <div className="flex h-9 items-center rounded-3xl border border-dashed px-3 text-muted-foreground text-xs">
                    —
                  </div>
                )}
              </div>
            </div>

            <Field label={t("invoices.dialog.status")}>
              <select
                className={controlClass}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                value={status}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`invoices.status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  {t("invoices.dialog.lineItems")}
                </span>
                <Button
                  onClick={() => setLineItems((prev) => [...prev, emptyLine()])}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Plus className="size-4" />
                  {t("invoices.dialog.addLine")}
                </Button>
              </div>
              {lineItems.map((li, i) => (
                <div
                  className="flex items-center gap-2"
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  key={i}
                >
                  <Input
                    aria-label={t("invoices.dialog.lineDescription")}
                    className="flex-1"
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                    placeholder={t("invoices.dialog.lineDescriptionPlaceholder")}
                    value={li.description}
                  />
                  <Input
                    aria-label={t("invoices.dialog.qty")}
                    className="w-16"
                    min={0}
                    onChange={(e) =>
                      updateLine(i, { quantity: Number(e.target.value) || 0 })
                    }
                    type="number"
                    value={li.quantity}
                  />
                  <Input
                    aria-label={t("invoices.dialog.unitPrice")}
                    className="w-24"
                    min={0}
                    onChange={(e) =>
                      updateLine(i, { unitPrice: Number(e.target.value) || 0 })
                    }
                    step="0.01"
                    type="number"
                    value={li.unitPrice}
                  />
                  <Button
                    aria-label="remove"
                    disabled={lineItems.length === 1}
                    onClick={() =>
                      setLineItems((prev) => prev.filter((_, j) => j !== i))
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">
                  {t("invoices.dialog.total")}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            <Field label={t("invoices.dialog.notes")}>
              <textarea
                className="min-h-16 w-full rounded-2xl border border-transparent bg-input/50 px-3 py-2 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("invoices.dialog.notesPlaceholder")}
                value={notes}
              />
            </Field>
          </DialogPanel>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("invoices.dialog.cancel")}
            </DialogClose>
            <Button disabled={busy} type="submit">
              {busy
                ? t("invoices.dialog.saving")
                : mode === "edit"
                  ? t("invoices.dialog.save")
                  : t("invoices.dialog.create")}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
