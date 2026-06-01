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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/chat/sparkline";
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

// Fixed width so the cards sit in a horizontal scroll row instead of squashing.
const rowCard = "w-80 shrink-0 snap-start";

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
  const latest = trend.points.at(-1);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>{`${trend.label} · last ${trend.points.length}`}</SectionLabel>
        <span className="text-foreground">
          {latest}
          <span className="text-muted-foreground"> {trend.unit}</span>
        </span>
      </div>
      <Sparkline points={trend.points} />
    </div>
  );
}

function SummaryCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{patient.initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-0.5">
            <CardTitle>{patient.name}</CardTitle>
            <CardDescription>
              {patient.age} · {sexLabel[patient.sex]} · MRN {patient.fileNumber}
            </CardDescription>
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
        {patient.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {patient.alerts.map((alert) => (
              <Badge key={alert} variant="outline">
                {alert}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <CardTitle>Vitals</CardTitle>
        <CardDescription>Taken {vitals.takenAt}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {vitalItems.map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
        <Separator />
        <TrendBlock trend={patient.vitalsTrend} />
      </CardContent>
    </Card>
  );
}

function LabsCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
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
              value={
                <span className="flex items-center gap-2">
                  {lab.value}
                  <Badge className="capitalize" variant={labFlagVariant[lab.flag]}>
                    {lab.flag}
                  </Badge>
                </span>
              }
            />
          ))}
        </div>
        <Separator />
        <TrendBlock trend={patient.labTrend} />
      </CardContent>
    </Card>
  );
}

function MedicationsCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <CardTitle>Medications</CardTitle>
        <CardDescription>{patient.medications.length} active</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {patient.medications.map((med) => (
          <Row
            key={med.name}
            label={med.name}
            value={`${med.dose} · ${med.frequency}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ProblemsCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <CardTitle>Problems</CardTitle>
        <CardDescription>{patient.problems.length} active</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {patient.problems.map((problem) => (
          <Row
            key={problem.label}
            label={problem.label}
            value={`since ${problem.since}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AllergiesCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <CardTitle>Allergies & alerts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {patient.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {patient.alerts.map((alert) => (
              <Badge key={alert} variant="outline">
                {alert}
              </Badge>
            ))}
          </div>
        )}
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
      </CardContent>
    </Card>
  );
}

function VisitsCard({ patient }: { patient: Patient }) {
  return (
    <Card className={rowCard} size="sm">
      <CardHeader>
        <CardTitle>Recent visits</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
      </CardContent>
    </Card>
  );
}

function LoadingCards() {
  return (
    <>
      <Card className={rowCard} size="sm">
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
        <Card className={rowCard} key={card} size="sm">
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
    <div className="no-scrollbar flex w-full snap-x items-stretch gap-4 overflow-x-auto pb-2">
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
