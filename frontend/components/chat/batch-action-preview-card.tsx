"use client";

import { AlertTriangle, Check, Pencil, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ACTION_ICONS,
  commitAction,
  summarize,
} from "@/components/chat/action-preview-card";
import { RecordEditDialog } from "@/components/chat/record-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionPreviewData } from "@/lib/ai-chat";
import { notify } from "@/lib/toast";

type Status = "pending" | "committing" | "done" | "rejected";

// A single approval surface for many agent-proposed records (e.g. an imported
// file of appointments) instead of one card per record. The clinician reviews
// the full list in a dialog, removes any they don't want, and adds them all at
// once. Each commit goes through the same RBAC-gated create endpoint as the
// single-record card; appointments without a file number create a patient.
export function BatchActionPreviewCard({
  items,
  onResolved,
}: {
  items: ActionPreviewData[];
  // Called once committed/discarded so the parent can persist the resolution
  // across re-render and conversation reload (prevents re-adding).
  onResolved?: (resolution: "added" | "discarded") => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>(
    items[0]?.resolved === "added"
      ? "done"
      : items[0]?.resolved === "discarded"
        ? "rejected"
        : "pending",
  );
  const [result, setResult] = useState<{ added: number; failed: number } | null>(
    null,
  );
  // Per-row edits, keyed by token. The committed record is the edit if present,
  // otherwise the agent's original proposal.
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>(
    {},
  );
  // The row currently open in the edit dialog.
  const [editing, setEditing] = useState<ActionPreviewData | null>(null);

  const recordFor = (it: ActionPreviewData) =>
    edits[it.token] ?? (it.record as Record<string, unknown>);

  const kept = useMemo(
    () => items.filter((it) => !removed.has(it.token)),
    [items, removed],
  );

  const Icon = ACTION_ICONS[items[0]?.kind ?? "appointment"];

  const addAll = async () => {
    setStatus("committing");
    let added = 0;
    let failed = 0;
    // Sequential so server-side patient de-dup (by name) sees prior creates.
    for (const it of kept) {
      try {
        await commitAction({ ...it, record: recordFor(it) });
        added += 1;
      } catch {
        failed += 1;
      }
    }
    setResult({ added, failed });
    setStatus("done");
    setOpen(false);
    onResolved?.("added");
    if (added > 0) {
      notify.success(
        t("chat.actionCard.addedTitle"),
        t("chat.actionCard.batch.done", { added, total: kept.length }),
      );
    } else if (failed > 0) {
      notify.error(
        t("chat.actionCard.failedTitle"),
        t("chat.actionCard.failedBody"),
      );
    }
  };

  const discardAll = () => {
    setStatus("rejected");
    setOpen(false);
    onResolved?.("discarded");
  };

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.actionCard.batch.title", { count: items.length })}
        </span>
        <Badge className="ms-auto gap-1" variant="secondary">
          <Sparkles className="size-3" />
          AI
        </Badge>
      </div>

      {status === "done" ? (
        <p className="flex items-center gap-1.5 text-foreground text-sm">
          <Check className="size-4" />
          {result
            ? `${t("chat.actionCard.batch.done", {
                added: result.added,
                total: items.length,
              })}${
                result.failed > 0
                  ? ` · ${t("chat.actionCard.batch.failedCount", { count: result.failed })}`
                  : ""
              }`
            : t("chat.actionCard.batch.alreadyAdded")}
        </p>
      ) : status === "rejected" ? (
        <p className="text-muted-foreground text-sm">
          {t("chat.actionCard.batch.discarded")}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Button onClick={() => setOpen(true)} size="sm">
            {t("chat.actionCard.batch.review")}
          </Button>
          <Button onClick={discardAll} size="sm" variant="outline">
            <X className="size-4" />
            {t("chat.actionCard.discard")}
          </Button>
        </div>
      )}

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chat.actionCard.batch.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("chat.actionCard.batch.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {kept.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">
                {t("chat.actionCard.batch.discarded")}
              </p>
            ) : (
              kept.map((it) => {
                const record = recordFor(it);
                const lines = summarize({ ...it, record });
                const newPatient =
                  it.kind === "appointment" && !record.fileNumber;
                const edited = it.token in edits;
                return (
                  <div
                    className="flex items-start gap-2 rounded-xl border bg-card/30 p-3"
                    key={it.token}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      {lines.map((line, i) => (
                        <span
                          className={
                            i === 0
                              ? "truncate font-medium text-foreground text-sm"
                              : "truncate text-muted-foreground text-xs"
                          }
                          key={line + i}
                        >
                          {line}
                        </span>
                      ))}
                      {edited ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Pencil className="size-3" />
                          {t("chat.actionCard.batch.edited")}
                        </span>
                      ) : null}
                      {newPatient ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Sparkles className="size-3" />
                          {t("chat.actionCard.batch.newPatient")}
                        </span>
                      ) : null}
                      {it.issues && it.issues.length > 0 ? (
                        <span className="mt-1 flex items-center gap-1 text-warning-foreground text-xs">
                          <AlertTriangle className="size-3" />
                          {it.issues[0]}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      aria-label={t("chat.actionCard.editButton")}
                      className="shrink-0"
                      onClick={() => setEditing({ ...it, record })}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      aria-label={t("chat.actionCard.batch.remove")}
                      className="shrink-0"
                      onClick={() =>
                        setRemoved((prev) => new Set(prev).add(it.token))
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </DialogPanel>

          <DialogFooter>
            <Button onClick={discardAll} type="button" variant="outline">
              {t("chat.actionCard.batch.discardAll")}
            </Button>
            <Button
              disabled={status === "committing" || kept.length === 0}
              onClick={addAll}
              type="button"
            >
              {status === "committing"
                ? t("chat.actionCard.batch.adding")
                : `${t("chat.actionCard.batch.addAll")} (${kept.length})`}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {editing ? (
        <RecordEditDialog
          kind={editing.kind}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          onSave={(record) =>
            setEdits((prev) => ({ ...prev, [editing.token]: record }))
          }
          open={editing !== null}
          record={editing.record as Record<string, unknown>}
        />
      ) : null}
    </Card>
  );
}
