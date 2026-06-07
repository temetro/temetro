"use client";

import { CircleCheck, Clock, Pill, Plus } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AddPrescriptionDialog,
  type NewPrescription,
} from "@/components/prescriptions/add-prescription-dialog";
import { PrescriptionDetailSheet } from "@/components/prescriptions/prescription-detail-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type Prescription,
  type RxStatus,
  createPrescription,
  formatPrescribedAt,
  listPrescriptions,
} from "@/lib/prescriptions";
import { notify } from "@/lib/toast";

export type { Prescription, RxStatus } from "@/lib/prescriptions";

const statusVariant: Record<
  RxStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  completed: "outline",
  expired: "destructive",
};

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

function RxRow({ rx, onOpen }: { rx: Prescription; onOpen: () => void }) {
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
      <Badge variant={statusVariant[rx.status]}>
        {t(`prescriptions.status.${rx.status}`)}
      </Badge>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function PrescriptionsView() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [list, setList] = useState<Prescription[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listPrescriptions()
      .then((data) => {
        if (active) setList(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the list empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const openRx = (rx: Prescription) => {
    setSelected(rx);
    setSheetOpen(true);
  };

  // Persist a new prescription, then add the saved record to the top of the list.
  const addPrescription = async (rx: NewPrescription) => {
    try {
      const created = await createPrescription({
        fileNumber: rx.fileNumber,
        name: rx.name,
        initials: rx.initials,
        medication: rx.medication,
        dose: rx.dose,
        frequency: rx.frequency,
        duration: rx.duration || null,
        notes: rx.notes || null,
      });
      setList((prev) => [created, ...prev]);
    } catch {
      notify.error(
        t("prescriptions.addFailedTitle"),
        t("prescriptions.addFailedBody"),
      );
    }
  };

  const kpis = useMemo(
    () => [
      {
        label: t("prescriptions.kpi.active"),
        value: String(list.filter((r) => r.status === "active").length),
        icon: Pill,
      },
      {
        label: t("prescriptions.kpi.completed"),
        value: String(list.filter((r) => r.status === "completed").length),
        icon: CircleCheck,
      },
      {
        label: t("prescriptions.kpi.expired"),
        value: String(list.filter((r) => r.status === "expired").length),
        icon: Clock,
      },
    ],
    [list, t],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("prescriptions.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("prescriptions.subtitle")}
          </p>
        </div>
        <Button
          className="rounded-3xl"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          {t("prescriptions.new")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <Section
        description={t("prescriptions.recentDescription")}
        title={t("prescriptions.recent")}
      >
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {list.map((rx) => (
            <RxRow key={rx.id} onOpen={() => openRx(rx)} rx={rx} />
          ))}
        </div>
      </Section>

      <AddPrescriptionDialog
        onAdd={addPrescription}
        onOpenChange={setAddOpen}
        open={addOpen}
      />

      <PrescriptionDetailSheet
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        rx={selected}
      />
    </div>
  );
}
