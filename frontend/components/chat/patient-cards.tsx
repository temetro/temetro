"use client";

import { ArrowRight, Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { Sparkline } from "@/components/chat/sparkline";
import { cn } from "@/lib/utils";
import type { AllergySeverity, LabFlag, Patient, Trend } from "@/lib/patients";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type PatientResultProps = {
  status: "loading" | "ready" | "not-found";
  fileNumber: string;
  patient?: Patient;
  onPatientUpdated?: (patient: Patient) => void;
  // "row" = horizontal scroll (chat); "column" = full-width vertical stack
  // (the Patients detail Sheet).
  layout?: "row" | "column";
};

const severityVariant: Record<AllergySeverity, BadgeVariant> = {
  mild: "outline",
  moderate: "secondary",
  severe: "destructive",
};

const labFlagVariant: Record<LabFlag, BadgeVariant> = {
  normal: "outline",
  low: "secondary",
  high: "secondary",
  critical: "destructive",
};

const statusVariant: Record<Patient["status"], BadgeVariant> = {
  active: "secondary",
  inpatient: "destructive",
  discharged: "outline",
};

// Fixed width so the cards sit in a horizontal scroll row instead of squashing,
// plus a subtle clickable affordance (they open a detail dialog). Compact cards
// size to their own (short) content — see `items-start` in PatientResult.
const rowCard =
  "w-72 shrink-0 cursor-pointer gap-0 text-left outline-none transition hover:bg-accent/30 hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring";

// COSS Card has no `size` variant; recreate the old compact ("sm") density by
// tightening the inner section padding from p-6 → p-4 via data-slot selectors.
const compactCard =
  "[&_[data-slot=card-header]]:p-4 [&_[data-slot=card-panel]]:px-4 [&_[data-slot=card-panel]]:pb-4";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-foreground">{label}</span>
      <span className="shrink-0 text-muted-foreground">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function TrendDetail({ trend }: { trend: Trend }) {
  const { t } = useTranslation();
  if (trend.points.length === 0) {
    return <Empty>{t("patientCard.trend.empty")}</Empty>;
  }
  const min = Math.min(...trend.points);
  const max = Math.max(...trend.points);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>
          {t("patientCard.trend.lastReadings", {
            label: trend.label,
            count: trend.points.length,
          })}
        </SectionLabel>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            {t("patientCard.trend.latest")}{" "}
            <span className="text-foreground">
              {trend.points.at(-1)} {trend.unit}
            </span>
          </span>
          <span>
            {t("patientCard.trend.min")}{" "}
            <span className="text-foreground">{min}</span>
          </span>
          <span>
            {t("patientCard.trend.max")}{" "}
            <span className="text-foreground">{max}</span>
          </span>
        </div>
      </div>
      <Sparkline className="h-24" points={trend.points} unit={trend.unit} />
    </div>
  );
}

function AlertBadges({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {alerts.map((alert) => (
        <Badge key={alert} variant="outline">
          {alert}
        </Badge>
      ))}
    </div>
  );
}

// A compact card that previews `children` and opens a roomier dialog of `detail`
// on click. A muted "Click for more" footer signals the card is expandable.
function ExpandableCard({
  title,
  description,
  detail,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  detail: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={<Card className={cn(rowCard, compactCard)} />}
      >
        {children}
        <div className="flex items-center gap-1 px-4 pt-2 pb-3 text-muted-foreground text-xs">
          {t("patientCard.clickForMore")}
          <ArrowRight className="size-3" />
        </div>
      </DialogTrigger>
      <DialogPopup className="max-h-[80dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogPanel className="min-h-0 flex-1 overflow-y-auto">
          {detail}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

function SummaryCard({
  patient,
  onEdit,
}: {
  patient: Patient;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const sex = t(`patientCard.sex.${patient.sex}`);
  const statusLabel = t(`patients.status.${patient.status}`);
  const idLine = `${patient.age} · ${sex} · MRN ${patient.fileNumber}`;
  return (
    <ExpandableCard
      description={idLine}
      detail={
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label={t("patientCard.summary.fullName")} value={patient.name} />
            <Stat label={t("patientCard.summary.mrn")} value={patient.fileNumber} />
            <Stat label={t("patientCard.summary.age")} value={patient.age} />
            <Stat label={t("patientCard.summary.sex")} value={sex} />
            <Stat label={t("patientCard.summary.primaryCare")} value={patient.pcp} />
            <Stat label={t("patientCard.summary.status")} value={statusLabel} />
            <Stat
              label={t("patientCard.summary.lastSeen")}
              value={patient.encounters[0]?.date ?? "—"}
            />
            <Stat
              label={t("patientCard.summary.allergies")}
              value={patient.allergies.length || t("patientCard.summary.none")}
            />
          </div>
          <AlertBadges alerts={patient.alerts} />
          {onEdit ? (
            <button
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-border/60 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground"
              onClick={onEdit}
              type="button"
            >
              <Pencil className="size-4" />
              {t("patientCard.summary.editRecord")}
            </button>
          ) : null}
        </div>
      }
      title={patient.name}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{patient.initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-0.5">
            <CardTitle>{patient.name}</CardTitle>
            <CardDescription>{idLine}</CardDescription>
          </div>
          <Badge variant={statusVariant[patient.status]}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0">
        <Stat
          label={t("patientCard.summary.activeMeds")}
          value={patient.medications.length}
        />
        <Stat
          label={t("patientCard.summary.openProblems")}
          value={patient.problems.length}
        />
      </CardContent>
    </ExpandableCard>
  );
}

function VitalsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const { vitals } = patient;
  const vitalItems = [
    { label: t("patientCard.vitals.bp"), value: vitals.bp },
    { label: t("patientCard.vitals.hr"), value: vitals.hr },
    { label: t("patientCard.vitals.temp"), value: vitals.temp },
    { label: t("patientCard.vitals.spo2"), value: vitals.spo2 },
  ];
  const vitalsGrid = (gapY: string) => (
    <div className={cn("grid grid-cols-2 gap-x-4", gapY)}>
      {vitalItems.map((item) => (
        <Stat key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );

  return (
    <ExpandableCard
      description={t("patientCard.vitals.taken", { at: vitals.takenAt })}
      detail={
        <div className="flex flex-col gap-4">
          {vitalsGrid("gap-y-3")}
          <Separator />
          <TrendDetail trend={patient.vitalsTrend} />
        </div>
      }
      title={t("patientCard.vitals.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.vitals.title")}</CardTitle>
        <CardDescription>
          {t("patientCard.vitals.taken", { at: vitals.takenAt })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 pt-0">
        <Stat label={t("patientCard.vitals.bp")} value={vitals.bp} />
        <Stat label={t("patientCard.vitals.hr")} value={vitals.hr} />
      </CardContent>
    </ExpandableCard>
  );
}

function LabValue({ value, flag }: { value: string; flag: LabFlag }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-2">
      {value}
      <Badge variant={labFlagVariant[flag]}>{t(`patientCard.labFlag.${flag}`)}</Badge>
    </span>
  );
}

function LabsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  return (
    <ExpandableCard
      description={t("patientCard.labs.asOf", {
        at: patient.labs[0]?.takenAt ?? "—",
      })}
      detail={
        patient.labs.length === 0 ? (
          <Empty>{t("patientCard.labs.empty")}</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              {patient.labs.map((lab) => (
                <div
                  className="flex items-center justify-between gap-3"
                  key={lab.name}
                >
                  <div className="flex flex-col">
                    <span className="text-foreground">{lab.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {lab.takenAt}
                    </span>
                  </div>
                  <LabValue flag={lab.flag} value={lab.value} />
                </div>
              ))}
            </div>
            <Separator />
            <TrendDetail trend={patient.labTrend} />
          </div>
        )
      }
      title={t("patientCard.labs.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.labs.title")}</CardTitle>
        <CardDescription>
          {t("patientCard.labs.asOf", { at: patient.labs[0]?.takenAt ?? "—" })}
        </CardDescription>
      </CardHeader>
    </ExpandableCard>
  );
}

function MedicationsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const list =
    patient.medications.length === 0 ? (
      <Empty>{t("patientCard.medications.empty")}</Empty>
    ) : (
      <div className="flex flex-col gap-2">
        {patient.medications.map((med) => (
          <Row
            key={med.name}
            label={med.name}
            value={`${med.dose} · ${med.frequency}`}
          />
        ))}
      </div>
    );
  return (
    <ExpandableCard
      description={t("patientCard.medications.active", {
        count: patient.medications.length,
      })}
      detail={list}
      title={t("patientCard.medications.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.medications.title")}</CardTitle>
        <CardDescription>
          {t("patientCard.medications.active", {
            count: patient.medications.length,
          })}
        </CardDescription>
      </CardHeader>
    </ExpandableCard>
  );
}

function ProblemsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const list =
    patient.problems.length === 0 ? (
      <Empty>{t("patientCard.problems.empty")}</Empty>
    ) : (
      <div className="flex flex-col gap-2">
        {patient.problems.map((problem) => (
          <Row
            key={problem.label}
            label={problem.label}
            value={t("patientCard.problems.since", { date: problem.since })}
          />
        ))}
      </div>
    );
  return (
    <ExpandableCard
      description={t("patientCard.problems.active", {
        count: patient.problems.length,
      })}
      detail={list}
      title={t("patientCard.problems.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.problems.title")}</CardTitle>
        <CardDescription>
          {t("patientCard.problems.active", { count: patient.problems.length })}
        </CardDescription>
      </CardHeader>
    </ExpandableCard>
  );
}

function AllergiesList({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <AlertBadges alerts={patient.alerts} />
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("patientCard.allergies.sectionLabel")}</SectionLabel>
        {patient.allergies.length === 0 ? (
          <p className="text-muted-foreground">
            {t("patientCard.allergies.none")}
          </p>
        ) : (
          patient.allergies.map((allergy) => (
            <Row
              key={allergy.substance}
              label={
                <>
                  {allergy.substance}
                  <span className="text-muted-foreground">
                    {" "}
                    — {allergy.reaction}
                  </span>
                </>
              }
              value={
                <Badge variant={severityVariant[allergy.severity]}>
                  {t(`patientCard.severity.${allergy.severity}`)}
                </Badge>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function AllergiesCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  return (
    <ExpandableCard
      detail={<AllergiesList patient={patient} />}
      title={t("patientCard.allergies.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.allergies.title")}</CardTitle>
        <CardDescription>
          {patient.allergies.length === 0
            ? t("patientCard.allergies.none")
            : t("patientCard.allergies.count", {
                count: patient.allergies.length,
              })}
        </CardDescription>
      </CardHeader>
      {patient.alerts.length > 0 ? (
        <CardContent className="pt-0">
          <AlertBadges alerts={patient.alerts} />
        </CardContent>
      ) : null}
    </ExpandableCard>
  );
}

function VisitsList({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  if (patient.encounters.length === 0) {
    return <Empty>{t("patientCard.visits.empty")}</Empty>;
  }
  return (
    <div className="flex flex-col gap-3">
      {patient.encounters.map((encounter) => (
        <div
          className="flex flex-col gap-0.5"
          key={encounter.date + encounter.type}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-foreground">{encounter.type}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {encounter.date}
            </span>
          </div>
          <span className="text-muted-foreground">{encounter.summary}</span>
          <span className="text-xs text-muted-foreground">
            {encounter.provider}
          </span>
        </div>
      ))}
    </div>
  );
}

function VisitsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  return (
    <ExpandableCard
      description={t("patientCard.visits.recent", {
        count: patient.encounters.length,
      })}
      detail={<VisitsList patient={patient} />}
      title={t("patientCard.visits.title")}
    >
      <CardHeader>
        <CardTitle>{t("patientCard.visits.title")}</CardTitle>
        <CardDescription>
          {t("patientCard.visits.recent", { count: patient.encounters.length })}
        </CardDescription>
      </CardHeader>
    </ExpandableCard>
  );
}

function LoadingCards() {
  return (
    <>
      <Card className={cn("w-80 shrink-0", compactCard)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((cell) => (
            <Skeleton className="h-8 w-full" key={cell} />
          ))}
        </CardContent>
      </Card>
      {[0, 1, 2, 3, 4, 5].map((card) => (
        <Card className={cn("w-80 shrink-0", compactCard)} key={card}>
          <CardHeader>
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <Skeleton className="h-3.5 w-full" key={row} />
            ))}
            {card % 2 === 1 && <Skeleton className="mt-1.5 h-10 w-full" />}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export function PatientResult({
  status,
  fileNumber,
  patient,
  onPatientUpdated,
  layout = "row",
}: PatientResultProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  // Bumped on open so the editor remounts with the latest patient data.
  const [editKey, setEditKey] = useState(0);

  if (status === "not-found") {
    return (
      <Card className={compactCard}>
        <CardContent>
          <p className="text-muted-foreground">
            {t("patientCard.notFound", { number: fileNumber })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-2",
        layout === "column"
          ? "flex-col [&_[data-slot=card]]:w-full"
          : "no-scrollbar items-stretch overflow-x-auto",
      )}
    >
      {status === "loading" || !patient ? (
        <LoadingCards />
      ) : (
        <>
          <SummaryCard
            onEdit={() => {
              setEditKey((k) => k + 1);
              setEditOpen(true);
            }}
            patient={patient}
          />
          <VitalsCard patient={patient} />
          <LabsCard patient={patient} />
          <MedicationsCard patient={patient} />
          <ProblemsCard patient={patient} />
          <AllergiesCard patient={patient} />
          <VisitsCard patient={patient} />
          <PatientFormDialog
            key={editKey}
            mode="edit"
            onOpenChange={setEditOpen}
            onSaved={(updated) => onPatientUpdated?.(updated)}
            open={editOpen}
            patient={patient}
          />
        </>
      )}
    </div>
  );
}
