"use client";

import {
  CircleCheck,
  Clock,
  PackageCheck,
  Pill,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrescriptionDetailSheet } from "@/components/prescriptions/prescription-detail-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  type Dispense,
  createDispense,
  deleteDispense,
  listDispenses,
} from "@/lib/dispenses";
import {
  type Prescription,
  formatPrescribedAt,
  listPrescriptions,
  updatePrescription,
} from "@/lib/prescriptions";
import { notify } from "@/lib/toast";

// "3 days" / "14 days" / "1 month" → a course length in days; null for
// open-ended values ("Ongoing", "As needed", free text we can't parse).
function parseDurationDays(duration: string | null): number | null {
  if (!duration) return null;
  const match = duration
    .trim()
    .toLowerCase()
    .match(/^(\d+)\s*(day|week|month)s?$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] === "day" ? 1 : match[2] === "week" ? 7 : 30;
  return n * unit;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// When an active course runs out, or null if it has no determinable end. An
// explicit `endDate` wins; otherwise we add the parsed duration to the start
// (the optional `startDate`, else `prescribedAt`).
function expiresAt(rx: Prescription): Date | null {
  if (rx.endDate && ISO_DATE.test(rx.endDate)) {
    return new Date(`${rx.endDate}T00:00:00`);
  }
  const days = parseDurationDays(rx.duration);
  if (days == null) return null;
  const base =
    rx.startDate && ISO_DATE.test(rx.startDate)
      ? rx.startDate
      : rx.prescribedAt;
  const end = new Date(`${base}T00:00:00`);
  end.setDate(end.getDate() + days);
  return end;
}

// ISO timestamp -> "Jun 16, 2026, 2:30 PM" for the dispensed feed.
function formatDispensedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Pill;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-semibold text-foreground text-lg tracking-tight">
          {value}
        </span>
      </div>
    </Card>
  );
}

function QueueRow({
  rx,
  expiring,
  onOpen,
  onComplete,
}: {
  rx: Prescription;
  expiring: boolean;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Avatar className="size-8">
        <AvatarFallback>{rx.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground text-sm">
          {rx.medication}
          {rx.dose && (
            <span className="font-normal text-muted-foreground"> · {rx.dose}</span>
          )}
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {rx.name} · #{rx.fileNumber} · {rx.frequency}
        </span>
      </div>
      <div className="hidden min-w-0 flex-col items-end sm:flex">
        <span className="truncate text-foreground text-xs">{rx.prescriber}</span>
        <span className="text-muted-foreground text-xs">
          {formatPrescribedAt(rx.prescribedAt)}
        </span>
      </div>
      {expiring && (
        <Badge variant="destructive">{t("pharmacy.expiringBadge")}</Badge>
      )}
      <Button
        onClick={(event) => {
          event.stopPropagation();
          onComplete();
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <CircleCheck className="size-4" />
        {t("pharmacy.dispense")}
      </Button>
    </div>
  );
}

// The pharmacy department home: a dispensing work queue over the clinic's
// prescriptions. Pharmacy holds prescription read/write (no delete and no
// create UI — prescribing stays with clinicians), so the only action here is
// completing a course.
export function PharmacyView() {
  const { t } = useTranslation();
  const [list, setList] = useState<Prescription[]>([]);
  const [dispenses, setDispenses] = useState<Dispense[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Dispense ledger entry staged for deletion (drives the confirm dialog).
  const [toDelete, setToDelete] = useState<Dispense | null>(null);

  useEffect(() => {
    let active = true;
    listPrescriptions()
      .then((data) => {
        if (active) setList(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the list empty */
      });
    listDispenses()
      .then((data) => {
        if (active) setDispenses(data);
      })
      .catch(() => {
        /* leave the dispensed feed empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const now = new Date();
  // Start of today, so a course ending today still counts as expiring (not
  // already elapsed by a few hours).
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Only flag courses genuinely about to run out (≤2 days left), not every
  // freshly-issued short course — which made the badge fire on nearly every row.
  const soon = new Date(startOfToday);
  soon.setDate(soon.getDate() + 2);
  const isExpiringSoon = (rx: Prescription) => {
    if (rx.status !== "active") return false;
    const end = expiresAt(rx);
    return end != null && end >= startOfToday && end <= soon;
  };

  const active = useMemo(
    () => list.filter((rx) => rx.status === "active"),
    [list],
  );

  // The dispensing queue: active prescriptions, oldest first.
  const search = query.trim().toLowerCase();
  const queue = useMemo(() => {
    const base = [...active].sort((a, b) =>
      a.prescribedAt.localeCompare(b.prescribedAt),
    );
    if (!search) return base;
    return base.filter(
      (rx) =>
        rx.name.toLowerCase().includes(search) ||
        rx.fileNumber.includes(search) ||
        rx.medication.toLowerCase().includes(search) ||
        rx.prescriber.toLowerCase().includes(search),
    );
  }, [active, search]);

  const kpis = [
    {
      label: t("pharmacy.kpi.active"),
      value: String(active.length),
      icon: Pill,
    },
    {
      label: t("pharmacy.kpi.expiring"),
      value: String(active.filter(isExpiringSoon).length),
      icon: Clock,
    },
    {
      label: t("pharmacy.kpi.patients"),
      value: String(new Set(active.map((rx) => rx.fileNumber)).size),
      icon: Users,
    },
  ];

  const openRx = (rx: Prescription) => {
    setSelected(rx);
    setSheetOpen(true);
  };

  // Dispensing records who received which medication (the fulfilment ledger) and
  // completes the course. PUT requires the full record — resend with the new
  // status.
  const dispense = async (rx: Prescription) => {
    try {
      const record = await createDispense({
        fileNumber: rx.fileNumber,
        name: rx.name,
        initials: rx.initials,
        medication: rx.medication,
        dose: rx.dose,
        prescriptionId: rx.id,
      });
      const updated = await updatePrescription(rx.id, {
        fileNumber: rx.fileNumber,
        name: rx.name,
        initials: rx.initials,
        medication: rx.medication,
        dose: rx.dose,
        frequency: rx.frequency,
        prescriber: rx.prescriber,
        prescribedAt: rx.prescribedAt,
        startDate: rx.startDate,
        endDate: rx.endDate,
        status: "completed",
        duration: rx.duration,
        notes: rx.notes,
      });
      setList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDispenses((prev) => [record, ...prev]);
      notify.success(
        t("pharmacy.dispensedTitle"),
        t("pharmacy.dispensedBody", { medication: rx.medication, name: rx.name }),
      );
    } catch {
      notify.error(t("pharmacy.completeFailedTitle"), t("pharmacy.completeFailedBody"));
    }
  };

  // Remove a dispense ledger entry (a correction — the medication itself isn't
  // un-dispensed, just the record).
  const confirmDelete = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    try {
      await deleteDispense(id);
      setDispenses((prev) => prev.filter((d) => d.id !== id));
      notify.success(t("pharmacy.dispensed.deletedTitle"), toDelete.medication);
    } catch {
      notify.error(
        t("pharmacy.dispensed.deleteFailedTitle"),
        t("pharmacy.dispensed.deleteFailedBody"),
      );
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("pharmacy.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pharmacy.subtitle")}</p>
        </div>
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 start-3 size-4 text-muted-foreground" />
          <Input
            className="w-full ps-9 sm:w-64"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("pharmacy.searchPlaceholder")}
            value={query}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("pharmacy.queue.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("pharmacy.queue.description")}
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {queue.map((rx) => (
            <QueueRow
              expiring={isExpiringSoon(rx)}
              key={rx.id}
              onComplete={() => dispense(rx)}
              onOpen={() => openRx(rx)}
              rx={rx}
            />
          ))}
          {queue.length === 0 && (
            <p className="p-6 text-center text-muted-foreground text-sm">
              {search ? t("pharmacy.queue.noMatches") : t("pharmacy.queue.empty")}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("pharmacy.dispensed.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("pharmacy.dispensed.description")}
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {dispenses.map((d) => (
            <div className="flex items-center gap-3 px-4 py-3" key={d.id}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                <PackageCheck className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium text-foreground text-sm">
                  {d.medication}
                  {d.dose && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {d.dose}
                    </span>
                  )}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {d.name}
                  {d.fileNumber ? ` · #${d.fileNumber}` : ""}
                </span>
              </div>
              <div className="hidden min-w-0 flex-col items-end sm:flex">
                <span className="truncate text-foreground text-xs">
                  {d.dispensedByName || "—"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDispensedAt(d.dispensedAt)}
                </span>
              </div>
              <button
                aria-label={t("pharmacy.dispensed.delete")}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive-foreground"
                onClick={() => setToDelete(d)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {dispenses.length === 0 && (
            <p className="p-6 text-center text-muted-foreground text-sm">
              {t("pharmacy.dispensed.empty")}
            </p>
          )}
        </div>
      </section>

      <PrescriptionDetailSheet
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        rx={selected}
      />

      <ConfirmDialog
        cancelLabel={t("pharmacy.dispensed.deleteCancel")}
        confirmLabel={t("pharmacy.dispensed.deleteConfirm")}
        description={
          toDelete
            ? t("pharmacy.dispensed.deleteBody", {
                medication: toDelete.medication,
                name: toDelete.name,
              })
            : undefined
        }
        onConfirm={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        open={toDelete !== null}
        title={t("pharmacy.dispensed.deleteTitle")}
      />
    </div>
  );
}
