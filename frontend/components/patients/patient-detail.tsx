"use client";

import {
  ArrowLeftRight,
  CalendarDays,
  FileDown,
  type LucideIcon,
  ListTodo,
  Mic,
  MoreHorizontal,
  Network,
  NotebookPen,
  Pencil,
  Pill,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Sparkline } from "@/components/chat/sparkline";
import { AttachmentsSection } from "@/components/patients/patient-files";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  type ActivityEntityType,
  type ActivityEntry,
  listPatientActivity,
} from "@/lib/activity";
import { printPatientSummary } from "@/lib/patient-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
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
import type { Appointment } from "@/lib/appointments";
import {
  formatMoney,
  type Invoice,
  invoiceTotal,
} from "@/lib/invoices";
import type { AllergySeverity, LabFlag, Patient, Trend } from "@/lib/patients";
import type { Prescription } from "@/lib/prescriptions";
import { listProviders, type Provider, specialtyLabel } from "@/lib/staff";
import { cn } from "@/lib/utils";

// A record "file" surfaced both in the graph and the sheet's clickable list.
type RecordFile = {
  id: string;
  kind: "problem" | "visit";
  title: string;
  sub: string;
  rows: { label: string; value: string }[];
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "info"
  | "warning";

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
  active: "success",
  inpatient: "info",
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

// Which icon marks each kind of audited change on the timeline.
const historyIcon: Record<ActivityEntityType, LucideIcon> = {
  appointment: CalendarDays,
  note: NotebookPen,
  patient: UserRound,
  prescription: Pill,
  task: ListTodo,
};

// The patient's record history: every audited add/change on this chart, newest
// first. Reuses the clinic activity log scoped to this file number, laid out as
// a vertical timeline — who made the change, what happened, and when.
function RecordHistory({ fileNumber }: { fileNumber: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    listPatientActivity(fileNumber)
      .then((e) => active && setEntries(e))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [fileNumber]);

  return (
    <Section title={t("patientCard.history.title")}>
      {error ? (
        <p className="text-muted-foreground text-sm">
          {t("patientCard.history.loadError")}
        </p>
      ) : entries === null ? (
        <p className="text-muted-foreground text-sm">{t("patients.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("patientCard.history.empty")}
        </p>
      ) : (
        // A plain vertical rail so EVERY audited change renders in full — the
        // icon column draws a connector that stretches to the next entry, and
        // the flex layout mirrors correctly under RTL.
        <ol className="space-y-0">
          {entries.map((e, i) => {
            const Icon = historyIcon[e.entityType] ?? Pencil;
            const isLast = i === entries.length - 1;
            return (
              <li className="flex gap-3" key={e.id}>
                <div className="flex flex-col items-center">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon size={14} />
                  </span>
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="my-1 w-px flex-1 bg-primary/15"
                    />
                  )}
                </div>
                <div
                  className={`min-w-0 flex-1 ${isLast ? "" : "pb-5"}`}
                >
                  <p className="font-medium text-foreground text-sm">
                    {e.actorName}
                  </p>
                  <p className="text-muted-foreground text-sm">{e.action}</p>
                  <time className="mt-0.5 block font-medium text-muted-foreground text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// Full patient record laid out vertically for the side Sheet — plain full-width
// sections (no fixed-width cards, no nested click-to-expand dialogs).
export function PatientDetail({
  patient,
  onEdit,
  onScribe,
  onWalletPush,
  onTransfer,
  onDelete,
  onOpenGraph,
  prescriptions,
  appointments,
  invoices,
}: {
  patient: Patient;
  onEdit?: () => void;
  // Opens the ambient AI visit scribe (record/transcribe → draft note).
  onScribe?: () => void;
  // Pushes the record to the patient's wallet (only when wallet-linked).
  onWalletPush?: () => void;
  onTransfer?: () => void;
  onDelete?: () => void;
  // Pops the record graph out into its own dialog (closing this sheet).
  onOpenGraph?: () => void;
  prescriptions?: Prescription[];
  appointments?: Appointment[];
  invoices?: Invoice[];
}) {
  const { t } = useTranslation();
  const sex = t(`patientCard.sex.${patient.sex}`);
  const idLine = `${patient.age} · ${sex} · MRN ${patient.fileNumber}`;
  // The record "file" opened in a detail dialog from the records list.
  const [openFile, setOpenFile] = useState<RecordFile | null>(null);

  // Resolve the responsible clinician's specialty (set by an admin in Care
  // Team) to show alongside the primary-care provider.
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    if (!patient.primaryProviderId) return;
    let active = true;
    listProviders()
      .then((p) => active && setProviders(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [patient.primaryProviderId]);
  const providerSpecialty = specialtyLabel(
    t,
    providers.find((p) => p.userId === patient.primaryProviderId)?.specialty,
  );

  // The same problems + visits the graph plots, as a clickable list.
  const files: RecordFile[] = [
    ...patient.problems.map((p, i) => ({
      id: `prob-${i}`,
      kind: "problem" as const,
      title: p.label,
      sub: p.since,
      rows: [{ label: t("patientCard.graph.fields.since"), value: p.since }],
    })),
    ...patient.encounters.map((e, i) => ({
      id: `enc-${i}`,
      kind: "visit" as const,
      title: e.type,
      sub: e.date,
      rows: [
        { label: t("patientCard.graph.fields.date"), value: e.date },
        { label: t("patientCard.graph.fields.provider"), value: e.provider },
        { label: t("patientCard.graph.fields.summary"), value: e.summary },
      ].filter((r) => r.value),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* Identity — full width so the name never gets squeezed by the actions. */}
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{patient.initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-base text-foreground">
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
        </div>
        {/* Actions — one primary (Edit) with the rest tucked into an overflow
            menu so the header stays uncluttered. */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button onClick={onEdit} size="sm" type="button" variant="outline">
              <Pencil className="size-4" />
              {t("patientCard.edit")}
            </Button>
          )}
          <Menu>
            <MenuTrigger
              render={
                <Button
                  aria-label={t("patientCard.moreActions")}
                  className="ms-auto"
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={() => printPatientSummary(patient, t)}>
                <FileDown className="size-4" />
                {t("patientCard.exportPdf")}
              </MenuItem>
              {onScribe && (
                <MenuItem onClick={onScribe}>
                  <Mic className="size-4" />
                  {t("scribe.recordVisit")}
                </MenuItem>
              )}
              {onTransfer && (
                <MenuItem onClick={onTransfer}>
                  <ArrowLeftRight className="size-4" />
                  {t("patients.transfer.action")}
                </MenuItem>
              )}
              {onWalletPush && (
                <MenuItem onClick={onWalletPush}>
                  <Send className="size-4" />
                  {t("walletPush.action")}
                </MenuItem>
              )}
              {onDelete && (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={onDelete} variant="destructive">
                    <Trash2 className="size-4" />
                    {t("patients.delete.action")}
                  </MenuItem>
                </>
              )}
            </MenuPopup>
          </Menu>
        </div>
      </div>

      <Section title={t("patientCard.overview")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat
            label={t("patientCard.summary.primaryCare")}
            value={
              providerSpecialty ? `${patient.pcp} · ${providerSpecialty}` : patient.pcp
            }
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
          <Stat
            label={t("patientCard.summary.bloodType")}
            value={patient.bloodType || "—"}
          />
          <Stat
            label={t("patientCard.summary.phone")}
            value={patient.phone || "—"}
          />
        </div>
      </Section>

      <Section title={t("patientCard.graph.title")}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              {t("patientCard.graph.hint")}
            </p>
            {onOpenGraph && (
              <Button
                className="shrink-0"
                onClick={onOpenGraph}
                size="sm"
                type="button"
                variant="outline"
              >
                <Network className="size-4" />
                {t("patientCard.graph.open")}
              </Button>
            )}
          </div>
          {files.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("patientCard.graph.empty")}
            </p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card/30">
              {files.map((file) => (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-accent"
                  key={file.id}
                  onClick={() => setOpenFile(file)}
                  type="button"
                >
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      file.kind === "problem"
                        ? "bg-destructive"
                        : "bg-foreground/55",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                    {file.title}
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {file.sub}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      <AttachmentsSection fileNumber={patient.fileNumber} />

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

      {appointments && (
        <Section title={t("patientCard.appointments.title")}>
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("patientCard.appointments.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {appointments.map((appt) => (
                <Row
                  key={appt.id}
                  label={`${appt.date} · ${appt.time}`}
                  value={
                    <span className="flex items-center gap-2">
                      {appt.type}
                      <Badge variant="outline">
                        {t(`appointments.status.${appt.status}`)}
                      </Badge>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {prescriptions && (
        <Section title={t("patientCard.prescriptions.title")}>
          {prescriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("patientCard.prescriptions.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {prescriptions.map((rx) => (
                <Row
                  key={rx.id}
                  label={rx.medication}
                  value={
                    <span className="flex items-center gap-2">
                      {`${rx.dose} · ${rx.frequency}`}
                      <Badge variant="outline">
                        {t(`prescriptions.status.${rx.status}`)}
                      </Badge>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {invoices && (
        <Section title={t("patientCard.invoices.title")}>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("patientCard.invoices.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <Row
                  key={inv.id}
                  label={inv.number}
                  value={
                    <span className="flex items-center gap-2 tabular-nums">
                      {formatMoney(invoiceTotal(inv))}
                      <Badge variant="outline">
                        {t(`invoices.status.${inv.status}`)}
                      </Badge>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Section>
      )}

      <RecordHistory fileNumber={patient.fileNumber} />

      <Dialog
        onOpenChange={(o) => {
          if (!o) setOpenFile(null);
        }}
        open={openFile !== null}
      >
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  openFile?.kind === "problem"
                    ? "bg-destructive"
                    : "bg-foreground/55",
                )}
              />
              {openFile?.title}
            </DialogTitle>
            <DialogDescription>
              {openFile
                ? t(`patientCard.graph.kind.${openFile.kind}`)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-3">
            {openFile?.rows.map((row) => (
              <div className="flex flex-col gap-0.5" key={row.label}>
                <span className="text-muted-foreground text-xs">
                  {row.label}
                </span>
                <span className="text-foreground text-sm">{row.value}</span>
              </div>
            ))}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("patientCard.graph.close")}
            </DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
