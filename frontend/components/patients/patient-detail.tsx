"use client";

import { ArrowLeftRight, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Sparkline } from "@/components/chat/sparkline";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AllergySeverity, LabFlag, Patient, Trend } from "@/lib/patients";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card/30 p-4">
      <h3 className="mb-3 font-medium text-foreground text-sm">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-foreground text-sm">{label}</span>
      <span className="shrink-0 text-muted-foreground text-sm">{value}</span>
    </div>
  );
}

function TrendBlock({ trend }: { trend: Trend }) {
  if (trend.points.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          {trend.label}
        </span>
        <span className="text-foreground text-sm">
          {trend.points.at(-1)}
          <span className="text-muted-foreground"> {trend.unit}</span>
        </span>
      </div>
      <div className="text-primary">
        <Sparkline className="h-12" points={trend.points} unit={trend.unit} />
      </div>
    </div>
  );
}

// Full patient record laid out vertically for the side Sheet — plain full-width
// sections (no fixed-width cards, no nested click-to-expand dialogs).
export function PatientDetail({
  patient,
  onEdit,
  onTransfer,
}: {
  patient: Patient;
  onEdit?: () => void;
  onTransfer?: () => void;
}) {
  const { t } = useTranslation();
  const sex = t(`patientCard.sex.${patient.sex}`);
  const idLine = `${patient.age} · ${sex} · MRN ${patient.fileNumber}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-12">
          <AvatarFallback>{patient.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-base text-foreground">
              {patient.name}
            </span>
            <Badge variant={statusVariant[patient.status]}>
              {t(`patients.status.${patient.status}`)}
            </Badge>
          </div>
          <span className="text-muted-foreground text-sm">{idLine}</span>
          {patient.alerts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {patient.alerts.map((alert) => (
                <Badge key={alert} variant="outline">
                  {alert}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onTransfer && (
            <Button
              onClick={onTransfer}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowLeftRight className="size-4" />
              {t("patients.transfer.action")}
            </Button>
          )}
          {onEdit && (
            <Button onClick={onEdit} size="sm" type="button" variant="outline">
              <Pencil className="size-4" />
              {t("patientCard.edit")}
            </Button>
          )}
        </div>
      </div>

      <Section title={t("patientCard.overview")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat
            label={t("patientCard.summary.primaryCare")}
            value={patient.pcp}
          />
          <Stat
            label={t("patientCard.summary.lastSeen")}
            value={patient.encounters[0]?.date ?? "—"}
          />
          <Stat
            label={t("patientCard.summary.activeMeds")}
            value={patient.medications.length}
          />
          <Stat
            label={t("patientCard.summary.openProblems")}
            value={patient.problems.length}
          />
        </div>
      </Section>

      <Section title={t("patientCard.vitals.title")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label={t("patientCard.vitals.bp")} value={patient.vitals.bp} />
          <Stat label={t("patientCard.vitals.hr")} value={patient.vitals.hr} />
          <Stat
            label={t("patientCard.vitals.temp")}
            value={patient.vitals.temp}
          />
          <Stat
            label={t("patientCard.vitals.spo2")}
            value={patient.vitals.spo2}
          />
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          {t("patientCard.vitals.taken", { at: patient.vitals.takenAt })}
        </p>
        <TrendBlock trend={patient.vitalsTrend} />
      </Section>

      <Section title={t("patientCard.labs.title")}>
        {patient.labs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("patientCard.labs.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {patient.labs.map((lab) => (
              <Row
                key={lab.name}
                label={lab.name}
                value={
                  <span className="flex items-center gap-2">
                    {lab.value}
                    <Badge variant={labFlagVariant[lab.flag]}>
                      {t(`patientCard.labFlag.${lab.flag}`)}
                    </Badge>
                  </span>
                }
              />
            ))}
          </div>
        )}
        <TrendBlock trend={patient.labTrend} />
      </Section>

      <Section title={t("patientCard.medications.title")}>
        {patient.medications.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("patientCard.medications.empty")}
          </p>
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
        )}
      </Section>

      <Section title={t("patientCard.problems.title")}>
        {patient.problems.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("patientCard.problems.empty")}
          </p>
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
        )}
      </Section>

      <Section title={t("patientCard.allergies.title")}>
        {patient.allergies.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("patientCard.allergies.none")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {patient.allergies.map((allergy) => (
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
            ))}
          </div>
        )}
      </Section>

      <Section title={t("patientCard.visits.title")}>
        {patient.encounters.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("patientCard.visits.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {patient.encounters.map((encounter) => (
              <div
                className="flex flex-col gap-0.5"
                key={encounter.date + encounter.type}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground text-sm">
                    {encounter.type}
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {encounter.date}
                  </span>
                </div>
                <span className="text-muted-foreground text-sm">
                  {encounter.summary}
                </span>
                <span className="text-muted-foreground text-xs">
                  {encounter.provider}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
