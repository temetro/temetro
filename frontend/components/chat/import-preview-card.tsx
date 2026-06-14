"use client";

import { AlertTriangle, Check, Database, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ImportPreviewData } from "@/lib/ai-chat";
import { commitImport } from "@/lib/ai-settings";
import { notify } from "@/lib/toast";

type Status = "pending" | "committing" | "done" | "rejected";

// The human approval gate for the migration import. The agent proposes records
// (dry run, nothing written); the clinician reviews counts + issues here and
// must approve before anything is inserted via POST /api/ai/import.
export function ImportPreviewCard({ data }: { data: ImportPreviewData }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("pending");
  const [result, setResult] = useState<{ created: number; failed: number } | null>(
    null,
  );

  const approve = async () => {
    setStatus("committing");
    try {
      const res = await commitImport(data.valid);
      setResult({ created: res.created.length, failed: res.failed.length });
      setStatus("done");
      notify.success(
        t("chat.importCard.importedTitle"),
        t("chat.importCard.importedBody", { count: res.created.length }),
      );
    } catch {
      setStatus("pending");
      notify.error(
        t("chat.importCard.failedTitle"),
        t("chat.importCard.failedBody"),
      );
    }
  };

  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("chat.importCard.title")}</span>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          {t("chat.importCard.ready")}{" "}
          <strong className="tabular-nums">{data.valid.length}</strong>
        </span>
        {data.invalid.length > 0 ? (
          <span className="flex items-center gap-1 text-warning-foreground">
            <AlertTriangle className="size-3.5" />
            {t("chat.importCard.skipped")}{" "}
            <strong className="tabular-nums">{data.invalid.length}</strong>
          </span>
        ) : null}
        <span className="text-muted-foreground">
          {t("chat.importCard.total")}{" "}
          <span className="tabular-nums">{data.total}</span>
        </span>
      </div>

      {data.invalid.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          {data.invalid.slice(0, 5).map((issue) => (
            <li className="truncate" key={issue.index}>
              {t("chat.importCard.row", { index: issue.index + 1 })}:{" "}
              {issue.errors[0]}
              {issue.errors.length > 1 ? ` (+${issue.errors.length - 1})` : ""}
            </li>
          ))}
          {data.invalid.length > 5 ? (
            <li className="text-muted-foreground/70">
              {t("chat.importCard.more", { count: data.invalid.length - 5 })}
            </li>
          ) : null}
        </ul>
      ) : null}

      {status === "done" && result ? (
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <Check className="size-4" />
          {t("chat.importCard.importedBody", { count: result.created })}
          {result.failed > 0
            ? ` · ${t("chat.importCard.failedCount", { count: result.failed })}`
            : ""}
        </p>
      ) : status === "rejected" ? (
        <p className="text-sm text-muted-foreground">
          {t("chat.importCard.rejectedNote")}
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            disabled={status === "committing" || data.valid.length === 0}
            onClick={approve}
            size="sm"
          >
            {status === "committing"
              ? t("chat.importCard.importing")
              : t("chat.importCard.approve", { count: data.valid.length })}
          </Button>
          <Button
            disabled={status === "committing"}
            onClick={() => setStatus("rejected")}
            size="sm"
            variant="outline"
          >
            <X className="size-4" />
            {t("chat.importCard.reject")}
          </Button>
        </div>
      )}
    </Card>
  );
}
