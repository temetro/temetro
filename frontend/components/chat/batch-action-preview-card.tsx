"use client";

import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ACTION_ICONS,
  commitAction,
  summarize,
} from "@/components/chat/action-preview-card";
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
export function BatchActionPreviewCard({ items }: { items: ActionPreviewData[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("pending");
  const [result, setResult] = useState<{ added: number; failed: number } | null>(
    null,
  );

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
        await commitAction(it);
        added += 1;
      } catch {
        failed += 1;
      }
    }
    setResult({ added, failed });
    setStatus("done");
    setOpen(false);
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
  };

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.actionCard.batch.title", { count: items.length })}
        </span>
        <Badge className="ml-auto gap-1" variant="secondary">
          <Sparkles className="size-3" />
          AI
        </Badge>
      </div>

      {status === "done" && result ? (
        <p className="flex items-center gap-1.5 text-foreground text-sm">
          <Check className="size-4" />
          {t("chat.actionCard.batch.done", {
            added: result.added,
            total: items.length,
          })}
          {result.failed > 0
            ? ` · ${t("chat.actionCard.batch.failedCount", { count: result.failed })}`
            : ""}
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
                const lines = summarize(it);
                const record = it.record as Record<string, unknown>;
                const newPatient =
                  it.kind === "appointment" && !record.fileNumber;
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
    </Card>
  );
}
