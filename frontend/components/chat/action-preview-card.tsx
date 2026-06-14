"use client";

import { AlertTriangle, CalendarPlus, Check, ClipboardList, Pill, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionPreviewData } from "@/lib/ai-chat";
import { type AppointmentInput, createAppointment } from "@/lib/appointments";
import { type PrescriptionInput, createPrescription } from "@/lib/prescriptions";
import { type TaskInput, createTask } from "@/lib/tasks";
import { notify } from "@/lib/toast";

type Status = "pending" | "committing" | "done" | "rejected";

const ICONS = {
  appointment: CalendarPlus,
  task: ClipboardList,
  prescription: Pill,
} as const;

// Summarise the proposed record into a couple of readable lines per kind.
function summarize(data: ActionPreviewData): string[] {
  const r = data.record as Record<string, unknown>;
  if (data.kind === "appointment") {
    return [
      String(r.name ?? ""),
      [r.date, r.time].filter(Boolean).join(" · "),
      [r.type, r.provider].filter(Boolean).join(" · "),
    ].filter(Boolean);
  }
  if (data.kind === "task") {
    return [
      String(r.title ?? ""),
      [r.assignee, r.due, r.priority].filter(Boolean).join(" · "),
    ].filter(Boolean);
  }
  // prescription
  return [
    [r.medication, r.dose].filter(Boolean).join(" "),
    [r.frequency, r.duration].filter(Boolean).join(" · "),
    String(r.name ?? ""),
  ].filter(Boolean);
}

async function commit(data: ActionPreviewData): Promise<void> {
  // Stamp provenance so the committed record is flagged "Added by AI" and shows
  // up for review/editing on the relevant page.
  if (data.kind === "appointment") {
    await createAppointment({
      ...(data.record as AppointmentInput),
      source: "ai",
    });
  } else if (data.kind === "task") {
    await createTask(data.record as TaskInput);
  } else {
    await createPrescription({
      ...(data.record as PrescriptionInput),
      source: "ai",
    });
  }
}

// The human approval gate for an agent-proposed add. The agent drafts the record
// (dry run, nothing written); the clinician reviews it here and must approve
// before it is committed via the matching RBAC-gated create endpoint.
export function ActionPreviewCard({ data }: { data: ActionPreviewData }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("pending");
  const Icon = ICONS[data.kind];
  const hasIssues = (data.issues?.length ?? 0) > 0;
  const lines = summarize(data);

  const approve = async () => {
    setStatus("committing");
    try {
      await commit(data);
      setStatus("done");
      notify.success(
        t("chat.actionCard.addedTitle"),
        t(`chat.actionCard.kind.${data.kind}`),
      );
    } catch {
      setStatus("pending");
      notify.error(
        t("chat.actionCard.failedTitle"),
        t("chat.actionCard.failedBody"),
      );
    }
  };

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t(`chat.actionCard.title.${data.kind}`)}
        </span>
      </div>

      <div className="space-y-0.5 text-sm">
        {lines.map((line, i) => (
          <p
            className={i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}
            key={line + i}
          >
            {line}
          </p>
        ))}
      </div>

      {hasIssues ? (
        <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs">
          {data.issues!.slice(0, 5).map((issue) => (
            <li className="flex items-start gap-1.5" key={issue}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
              {issue}
            </li>
          ))}
        </ul>
      ) : null}

      {status === "done" ? (
        <p className="flex items-center gap-1.5 text-foreground text-sm">
          <Check className="size-4" />
          {t("chat.actionCard.added")}
        </p>
      ) : status === "rejected" ? (
        <p className="text-muted-foreground text-sm">
          {t("chat.actionCard.discarded")}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            disabled={status === "committing" || hasIssues}
            onClick={approve}
            size="sm"
          >
            {status === "committing"
              ? t("chat.actionCard.adding")
              : t("chat.actionCard.approve")}
          </Button>
          <Button
            disabled={status === "committing"}
            onClick={() => setStatus("rejected")}
            size="sm"
            variant="outline"
          >
            <X className="size-4" />
            {t("chat.actionCard.discard")}
          </Button>
        </div>
      )}
    </Card>
  );
}
