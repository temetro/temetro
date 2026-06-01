"use client";

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
import type { AllergySeverity, LabFlag, Patient } from "@/lib/patients";

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

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function SummaryCard({ patient }: { patient: Patient }) {
  return (
    <Card size="sm">
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
      <CardContent>
        <span className="text-muted-foreground">Primary care: </span>
        <span className="text-foreground">{patient.pcp}</span>
      </CardContent>
    </Card>
  );
}

function AllergiesCard({ patient }: { patient: Patient }) {
  return (
    <Card size="sm">
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
              <div
                className="flex items-center justify-between gap-3"
                key={allergy.substance}
              >
                <span className="text-foreground">
                  {allergy.substance}
                  <span className="text-muted-foreground">
                    {" "}
                    — {allergy.reaction}
                  </span>
                </span>
                <Badge
                  className="capitalize"
                  variant={severityVariant[allergy.severity]}
                >
                  {allergy.severity}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationsCard({ patient }: { patient: Patient }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Medications & problems</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <SectionLabel>Active medications</SectionLabel>
          {patient.medications.map((med) => (
            <div className="flex items-baseline justify-between gap-3" key={med.name}>
              <span className="text-foreground">{med.name}</span>
              <span className="text-muted-foreground">
                {med.dose} · {med.frequency}
              </span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <SectionLabel>Problem list</SectionLabel>
          {patient.problems.map((problem) => (
            <div
              className="flex items-baseline justify-between gap-3"
              key={problem.label}
            >
              <span className="text-foreground">{problem.label}</span>
              <span className="text-muted-foreground">since {problem.since}</span>
            </div>
          ))}
        </div>
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
    <Card size="sm">
      <CardHeader>
        <CardTitle>Vitals, labs & visits</CardTitle>
        <CardDescription>Vitals taken {vitals.takenAt}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {vitalItems.map((item) => (
            <div className="flex flex-col gap-0.5" key={item.label}>
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <SectionLabel>Recent labs</SectionLabel>
          {patient.labs.map((lab) => (
            <div className="flex items-center justify-between gap-3" key={lab.name}>
              <span className="text-foreground">{lab.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{lab.value}</span>
                <Badge className="capitalize" variant={labFlagVariant[lab.flag]}>
                  {lab.flag}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <SectionLabel>Recent visits</SectionLabel>
          {patient.encounters.map((encounter) => (
            <div className="flex flex-col gap-0.5" key={encounter.date + encounter.type}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-foreground">{encounter.type}</span>
                <span className="text-xs text-muted-foreground">{encounter.date}</span>
              </div>
              <span className="text-muted-foreground">{encounter.summary}</span>
              <span className="text-xs text-muted-foreground">{encounter.provider}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingCards() {
  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </CardHeader>
      </Card>
      {[0, 1, 2].map((card) => (
        <Card key={card} size="sm">
          <CardHeader>
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <Skeleton className="h-3.5 w-full" key={row} />
            ))}
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
    <div className="flex w-full flex-col gap-4">
      {status === "loading" || !patient ? (
        <LoadingCards />
      ) : (
        <>
          <SummaryCard patient={patient} />
          <AllergiesCard patient={patient} />
          <MedicationsCard patient={patient} />
          <VitalsCard patient={patient} />
        </>
      )}
    </div>
  );
}
