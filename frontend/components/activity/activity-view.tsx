"use client";

import {
  Clock,
  FileText,
  Hash,
  type LucideIcon,
  NotebookPen,
  Pill,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// All entries here are mock/placeholder data — there is no signing/ledger
// backend yet. They illustrate temetro's patient-owned, signed-change vision:
// every record change is signed (blockchain-style) and awaits patient approval.

type ActivityStatus = "signed" | "pending";

type ActivityEntry = {
  id: string;
  actor: string;
  initials: string;
  action: string;
  patient: string;
  fileNumber: string;
  time: string;
  hash: string;
  status: ActivityStatus;
  icon: LucideIcon;
};

const entries: ActivityEntry[] = [
  {
    id: "1",
    actor: "Dr. Okafor",
    initials: "DO",
    action: "Updated vitals",
    patient: "Amina Yusuf",
    fileNumber: "10293",
    time: "Today, 10:24",
    hash: "0x9f3a…c21",
    status: "pending",
    icon: Stethoscope,
  },
  {
    id: "2",
    actor: "Dr. Okafor",
    initials: "DO",
    action: "Added prescription — Lisinopril 10mg",
    patient: "Amina Yusuf",
    fileNumber: "10293",
    time: "Today, 10:21",
    hash: "0x4b8e…7df",
    status: "pending",
    icon: Pill,
  },
  {
    id: "3",
    actor: "Dr. Stein",
    initials: "DS",
    action: "Created note — Lab review",
    patient: "Leila Haddad",
    fileNumber: "10342",
    time: "Today, 09:48",
    hash: "0x1c07…a90",
    status: "signed",
    icon: NotebookPen,
  },
  {
    id: "4",
    actor: "Dr. Stein",
    initials: "DS",
    action: "Edited allergies — added Penicillin",
    patient: "Daniel Mensah",
    fileNumber: "10311",
    time: "Yesterday, 16:05",
    hash: "0xab12…44e",
    status: "signed",
    icon: TriangleAlert,
  },
  {
    id: "5",
    actor: "Dr. Okafor",
    initials: "DO",
    action: "Imported prior records",
    patient: "Carlos Rivera",
    fileNumber: "10358",
    time: "Yesterday, 14:30",
    hash: "0x77f0…b3c",
    status: "signed",
    icon: FileText,
  },
];

const kpis = [
  { label: "Pending approvals", value: "2", icon: Clock },
  { label: "Signed today", value: "1", icon: ShieldCheck },
  { label: "Changes this week", value: "37", icon: Hash },
];

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
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

export function ActivityView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          A signed, tamper-evident log of record changes awaiting patient
          approval. Sample data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <ol className="flex flex-col">
        {entries.map((entry, i) => {
          const Icon = entry.icon;
          const isLast = i === entries.length - 1;
          return (
            <li className="flex gap-4" key={entry.id}>
              <div className="flex flex-col items-center">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
              </div>

              <div className={cn("flex-1", isLast ? "pb-0" : "pb-6")}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {entry.action}
                  </span>
                  {entry.status === "signed" ? (
                    <Badge
                      className="shrink-0 border-success/40 text-success"
                      variant="outline"
                    >
                      <ShieldCheck className="size-3" />
                      Signed
                    </Badge>
                  ) : (
                    <Badge
                      className="shrink-0 border-warning/40 text-warning"
                      variant="outline"
                    >
                      <Clock className="size-3" />
                      Pending approval
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[10px]">
                      {entry.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground text-xs">
                    {entry.actor} · {entry.patient} (#{entry.fileNumber})
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{entry.time}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    <Hash className="size-3" />
                    {entry.hash}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
