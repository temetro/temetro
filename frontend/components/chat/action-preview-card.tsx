"use client";

import {
  AlertTriangle,
  Boxes,
  CalendarPlus,
  Check,
  ClipboardList,
  Pencil,
  Pill,
  Receipt,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RecordEditDialog } from "@/components/chat/record-edit-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActionPreviewData, ActionPreviewKind } from "@/lib/ai-chat";
import { type AppointmentInput, createAppointment } from "@/lib/appointments";
import {
  createInvoice,
  formatMoney,
  type InvoiceInput,
  type InvoiceLineItem,
} from "@/lib/invoices";
import { type InventoryInput, createInventory } from "@/lib/inventory";
import { type PrescriptionInput, createPrescription } from "@/lib/prescriptions";
import { type TaskInput, createTask } from "@/lib/tasks";
import { notify } from "@/lib/toast";

type Status = "pending" | "committing" | "done" | "rejected";

export const ACTION_ICONS = {
  appointment: CalendarPlus,
  task: ClipboardList,
  prescription: Pill,
  invoice: Receipt,
  inventory: Boxes,
} as const;

const ICONS = ACTION_ICONS;

// Summarise the proposed record into a couple of readable lines per kind.
export function summarize(data: ActionPreviewData): string[] {
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
  if (data.kind === "invoice") {
    const items = (r.lineItems as InvoiceLineItem[] | undefined) ?? [];
    const total = items.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
    return [
      String(r.name ?? ""),
      `${items.length} item${items.length === 1 ? "" : "s"} · ${formatMoney(total)}`,
    ].filter(Boolean);
  }
  if (data.kind === "inventory") {
    const items = (r.items as InventoryInput[] | undefined) ?? [];
    return [
      `${items.length} item${items.length === 1 ? "" : "s"}`,
      items
        .map((it) =>
          [it.name, it.strength].filter(Boolean).join(" ") +
          (it.stockQuantity ? ` ×${it.stockQuantity}` : ""),
        )
        .join(", "),
    ].filter(Boolean);
  }
  // prescription
  return [
    [r.medication, r.dose].filter(Boolean).join(" "),
    [r.frequency, r.duration].filter(Boolean).join(" · "),
    String(r.name ?? ""),
  ].filter(Boolean);
}

export async function commitAction(data: ActionPreviewData): Promise<void> {
  // Stamp provenance so the committed record is flagged "Added by AI" and shows
  // up for review/editing on the relevant page.
  if (data.kind === "appointment") {
    await createAppointment({
      ...(data.record as AppointmentInput),
      source: "ai",
    });
  } else if (data.kind === "task") {
    await createTask(data.record as TaskInput);
  } else if (data.kind === "invoice") {
    await createInvoice({ ...(data.record as InvoiceInput), source: "ai" });
  } else if (data.kind === "inventory") {
    const { items = [] } = data.record as { items?: InventoryInput[] };
    // Commit each proposed stock item via the RBAC-gated create endpoint.
    for (const item of items) {
      await createInventory(item);
    }
  } else {
    await createPrescription({
      ...(data.record as PrescriptionInput),
      source: "ai",
    });
  }
}

// A structured, de-densified view of a proposed record. Inventory and invoice
// records carry an item array — rendered as a compact scrollable list (one row
// per item) rather than a single comma-joined wall of text; everything else
// uses the per-kind summary lines.
export function RecordSummary({
  kind,
  record,
}: {
  kind: ActionPreviewKind;
  record: Record<string, unknown>;
}) {
  const { t } = useTranslation();

  if (kind === "inventory") {
    const items = (record.items as InventoryInput[] | undefined) ?? [];
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">
          {t("chat.actionCard.itemCount", { count: items.length })}
        </p>
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border bg-card/30">
          {items.map((it, i) => (
            <li
              className="flex items-center gap-2 px-3 py-1.5 text-sm"
              key={`${it.name}-${i}`}
            >
              <span className="min-w-0 flex-1 truncate text-foreground">
                {it.name}
                {it.strength ? (
                  <span className="text-muted-foreground"> · {it.strength}</span>
                ) : null}
              </span>
              {it.stockQuantity != null ? (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  ×{it.stockQuantity}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === "invoice") {
    const items = (record.lineItems as InvoiceLineItem[] | undefined) ?? [];
    const total = items.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
    return (
      <div className="flex flex-col gap-2">
        {record.name ? (
          <p className="font-medium text-foreground text-sm">
            {String(record.name)}
          </p>
        ) : null}
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border bg-card/30">
          {items.map((li, i) => (
            <li
              className="flex items-center gap-2 px-3 py-1.5 text-sm"
              key={`${li.description}-${i}`}
            >
              <span className="min-w-0 flex-1 truncate text-foreground">
                {li.description}
                <span className="text-muted-foreground"> ×{li.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoney(li.quantity * li.unitPrice)}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("chat.actionCard.total")}
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(total)}
          </span>
        </p>
      </div>
    );
  }

  const lines = summarize({ kind, record } as ActionPreviewData);
  return (
    <div className="space-y-0.5 text-sm">
      {lines.map((line, i) => (
        <p
          className={
            i === 0 ? "font-medium text-foreground" : "text-muted-foreground"
          }
          key={line + i}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

// The human approval gate for an agent-proposed add. The agent drafts the record
// (dry run, nothing written); the clinician reviews it here, may edit it, and
// must approve before it is committed via the matching RBAC-gated create endpoint.
export function ActionPreviewCard({ data }: { data: ActionPreviewData }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("pending");
  // Editable working copy of the proposed record (edits commit, not the draft).
  const [record, setRecord] = useState<Record<string, unknown>>(
    data.record as Record<string, unknown>,
  );
  const [editOpen, setEditOpen] = useState(false);
  const Icon = ICONS[data.kind];
  const hasIssues = (data.issues?.length ?? 0) > 0;

  const approve = async () => {
    setStatus("committing");
    try {
      await commitAction({ ...data, record });
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

  const editable = status === "pending";

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t(`chat.actionCard.title.${data.kind}`)}
        </span>
        {editable ? (
          <Button
            className="ml-auto"
            onClick={() => setEditOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
            {t("chat.actionCard.editButton")}
          </Button>
        ) : null}
      </div>

      <RecordSummary kind={data.kind} record={record} />

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

      <RecordEditDialog
        kind={data.kind}
        onOpenChange={setEditOpen}
        onSave={setRecord}
        open={editOpen}
        record={record}
      />
    </Card>
  );
}
