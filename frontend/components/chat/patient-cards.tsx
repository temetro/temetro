"use client";

import type { ReactNode } from "react";

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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/chat/sparkline";
import { cn } from "@/lib/utils";
import type { AllergySeverity, LabFlag, Patient, Trend } from "@/lib/patients";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type PatientResultProps = {
  status: "loading" | "ready" | "not-found";
  fileNumber: string;
  patient?: Patient;
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

const sexLabel: Record<Patient["sex"], string> = { F: "Female", M: "Male" };

// Fixed width so the cards sit in a horizontal scroll row instead of squashing,
// plus a subtle clickable affordance (they open a detail dialog).
const rowCard =
  "w-80 shrink-0 cursor-pointer snap-start text-left outline-none transition hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring";

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

function TrendBlock({ trend }: { trend: Trend }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>{`${trend.label} · last ${trend.points.length}`}</SectionLabel>
        <span className="text-foreground">
          {trend.points.at(-1)}
          <span className="text-muted-foreground"> {trend.unit}</span>
        </span>
      </div>
      <Sparkline points={trend.points} unit={trend.unit} />
    </div>
  );
}

function TrendDetail({ trend }: { trend: Trend }) {
  const min = Math.min(...trend.points);
  const max = Math.max(...trend.points);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{`${trend.label} · last ${trend.points.length} readings`}</SectionLabel>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            Latest{" "}
            <span className="text-foreground">
              {trend.points.at(-1)} {trend.unit}
            </span>
          </span>
          <span>
            Min <span className="text-foreground">{min}</span>
          </span>
          <span>
            Max <span className="text-foreground">{max}</span>
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

// A card that previews `children` and opens a roomier dialog of `detail` on click.
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
  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        render={<Card className={rowCard} size="sm" />}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {detail}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ patient }: { patient: Patient }) {
  const idLine = `${patient.age} · ${sexLabel[patient.sex]} · MRN ${patient.fileNumber}`;
  return (
    <ExpandableCard
      description={idLine}
      detail={
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="Full name" value={patient.name} />
            <Stat label="MRN" value={patient.fileNumber} />
            <Stat label="Age" value={patient.age} />
            <Stat label="Sex" value={sexLabel[patient.sex]} />
            <Stat label="Primary care" value={patient.pcp} />
            <Stat
              label="Status"
              value={<span className="capitalize">{patient.status}</span>}
            />
            <Stat label="Last seen" value={patient.encounters[0]?.date ?? "—"} />
            <Stat
              label="Allergies"
              value={patient.allergies.length || "None"}
            />
          </div>
          <AlertBadges alerts={patient.alerts} />
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
          <Badge className="capitalize" variant={statusVariant[patient.status]}>
            {patient.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Stat label="Primary care" value={patient.pcp} />
          <Stat label="Last seen" value={patient.encounters[0]?.date ?? "—"} />
          <Stat label="Active meds" value={patient.medications.length} />
          <Stat label="Open problems" value={patient.problems.length} />
        </div>
        <AlertBadges alerts={patient.alerts} />
      </CardContent>
    </ExpandableCard>
  );
}

function VitalsCard({ patient }: { patient: Patient }) {
  const { vitals } = patient;
  const vitalItems = [
    { label: "BP", value: vitals.bp },
    { label: "HR", value: vitals.hr },
    { label: "Temp", value: vitals.temp },
    { label: "SpO₂", value: vitals.spo2 },
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
      description={`Taken ${vitals.takenAt}`}
      detail={
        <div className="flex flex-col gap-4">
          {vitalsGrid("gap-y-3")}
          <Separator />
          <TrendDetail trend={patient.vitalsTrend} />
        </div>
      }
      title="Vitals"
    >
      <CardHeader>
        <CardTitle>Vitals</CardTitle>
        <CardDescription>Taken {vitals.takenAt}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {vitalsGrid("gap-y-3")}
        <Separator />
        <TrendBlock trend={patient.vitalsTrend} />
      </CardContent>
    </ExpandableCard>
  );
}

function labValue(value: string, flag: LabFlag) {
  return (
    <span className="flex items-center gap-2">
      {value}
      <Badge className="capitalize" variant={labFlagVariant[flag]}>
        {flag}
      </Badge>
    </span>
  );
}

function LabsCard({ patient }: { patient: Patient }) {
  return (
    <ExpandableCard
      description={`As of ${patient.labs[0]?.takenAt ?? "—"}`}
      detail={
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
                {labValue(lab.value, lab.flag)}
              </div>
            ))}
          </div>
          <Separator />
          <TrendDetail trend={patient.labTrend} />
        </div>
      }
      title="Labs"
    >
      <CardHeader>
        <CardTitle>Labs</CardTitle>
        <CardDescription>As of {patient.labs[0]?.takenAt ?? "—"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {patient.labs.map((lab) => (
            <Row
              key={lab.name}
              label={lab.name}
              value={labValue(lab.value, lab.flag)}
            />
          ))}
        </div>
        <Separator />
        <TrendBlock trend={patient.labTrend} />
      </CardContent>
    </ExpandableCard>
  );
}

function MedicationsCard({ patient }: { patient: Patient }) {
  const list = (
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
      description={`${patient.medications.length} active`}
      detail={list}
      title="Medications"
    >
      <CardHeader>
        <CardTitle>Medications</CardTitle>
        <CardDescription>{patient.medications.length} active</CardDescription>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </ExpandableCard>
  );
}

function ProblemsCard({ patient }: { patient: Patient }) {
  const list = (
    <div className="flex flex-col gap-2">
      {patient.problems.map((problem) => (
        <Row
          key={problem.label}
          label={problem.label}
          value={`since ${problem.since}`}
        />
      ))}
    </div>
  );
  return (
    <ExpandableCard
      description={`${patient.problems.length} active`}
      detail={list}
      title="Problems"
    >
      <CardHeader>
        <CardTitle>Problems</CardTitle>
        <CardDescription>{patient.problems.length} active</CardDescription>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </ExpandableCard>
  );
}

function AllergiesList({ patient }: { patient: Patient }) {
  return (
    <div className="flex flex-col gap-4">
      <AlertBadges alerts={patient.alerts} />
      <div className="flex flex-col gap-2">
        <SectionLabel>Allergies</SectionLabel>
        {patient.allergies.length === 0 ? (
          <p className="text-muted-foreground">No known allergies.</p>
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
                <Badge
                  className="capitalize"
                  variant={severityVariant[allergy.severity]}
                >
                  {allergy.severity}
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
  return (
    <ExpandableCard
      detail={<AllergiesList patient={patient} />}
      title="Allergies & alerts"
    >
      <CardHeader>
        <CardTitle>Allergies & alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <AllergiesList patient={patient} />
      </CardContent>
    </ExpandableCard>
  );
}

function VisitsList({ patient }: { patient: Patient }) {
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
  return (
    <ExpandableCard
      description={`${patient.encounters.length} recent`}
      detail={<VisitsList patient={patient} />}
      title="Recent visits"
    >
      <CardHeader>
        <CardTitle>Recent visits</CardTitle>
      </CardHeader>
      <CardContent>
        <VisitsList patient={patient} />
      </CardContent>
    </ExpandableCard>
  );
}

function LoadingCards() {
  return (
    <>
      <Card className="w-80 shrink-0 snap-start" size="sm">
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
        <Card className="w-80 shrink-0 snap-start" key={card} size="sm">
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

export function PatientResult({ status, fileNumber, patient }: PatientResultProps) {
  if (status === "not-found") {
    return (
      <Card size="sm">
        <CardContent>
          <p className="text-muted-foreground">
            No patient found for file #{fileNumber}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="no-scrollbar flex w-full snap-x items-stretch gap-4 overflow-x-auto p-2">
      {status === "loading" || !patient ? (
        <LoadingCards />
      ) : (
        <>
          <SummaryCard patient={patient} />
          <VitalsCard patient={patient} />
          <LabsCard patient={patient} />
          <MedicationsCard patient={patient} />
          <ProblemsCard patient={patient} />
          <AllergiesCard patient={patient} />
          <VisitsCard patient={patient} />
        </>
      )}
    </div>
  );
}
