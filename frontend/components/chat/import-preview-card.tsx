"use client";

import { AlertTriangle, Check, Database, Pencil, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import type { ImportPreviewData } from "@/lib/ai-chat";
import { commitImport, validateImport } from "@/lib/ai-settings";
import type { AllergySeverity, LabFlag, Patient } from "@/lib/patients";
import { notify } from "@/lib/toast";

type Status = "pending" | "committing" | "done" | "rejected";

const str = (v: unknown): string => (v == null ? "" : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Coerce an arbitrary parsed record (a normalized valid row, or a raw invalid
// one with bare-string lists / gender words) into a complete Patient the form
// can render and edit. Mirrors the backend's tolerant normalization.
function toPatientDraft(rec: unknown): Patient {
  const r = (rec ?? {}) as Record<string, unknown>;
  const sx = str(r.sex).trim().toLowerCase();
  const sex: Patient["sex"] = sx.startsWith("f") || sx.startsWith("w") ? "F" : "M";
  const status = (["active", "inpatient", "discharged"] as const).includes(
    r.status as Patient["status"],
  )
    ? (r.status as Patient["status"])
    : "active";
  const obj = (v: unknown) => (v ?? {}) as Record<string, unknown>;

  return {
    fileNumber: str(r.fileNumber).replace(/\D/g, ""),
    name: str(r.name),
    age: Number(r.age) || 0,
    sex,
    pcp: str(r.pcp),
    primaryProviderId: (r.primaryProviderId as string | null) ?? null,
    status,
    initials: str(r.initials),
    alerts: arr(r.alerts).map(str),
    allergies: arr(r.allergies).map((a) =>
      typeof a === "string"
        ? { substance: a, reaction: "", severity: "mild" as AllergySeverity }
        : {
            substance: str(obj(a).substance),
            reaction: str(obj(a).reaction),
            severity: (["mild", "moderate", "severe"].includes(
              obj(a).severity as string,
            )
              ? obj(a).severity
              : "mild") as AllergySeverity,
          },
    ),
    medications: arr(r.medications).map((m) =>
      typeof m === "string"
        ? { name: m, dose: "", frequency: "" }
        : {
            name: str(obj(m).name),
            dose: str(obj(m).dose),
            frequency: str(obj(m).frequency),
          },
    ),
    problems: arr(r.problems).map((p) =>
      typeof p === "string"
        ? { label: p, since: "" }
        : { label: str(obj(p).label), since: str(obj(p).since) },
    ),
    vitals: {
      bp: str(obj(r.vitals).bp),
      hr: str(obj(r.vitals).hr),
      temp: str(obj(r.vitals).temp),
      spo2: str(obj(r.vitals).spo2),
      takenAt: str(obj(r.vitals).takenAt),
    },
    vitalsTrend: { label: "", unit: "", points: [] },
    labs: arr(r.labs).map((l) => ({
      name: str(obj(l).name),
      value: str(obj(l).value),
      flag: (["normal", "high", "low", "critical"].includes(
        obj(l).flag as string,
      )
        ? obj(l).flag
        : "normal") as LabFlag,
      takenAt: str(obj(l).takenAt),
    })),
    labTrend: { label: "", unit: "", points: [] },
    encounters: arr(r.encounters).map((e) => ({
      type: str(obj(e).type) || "Visit",
      date: str(obj(e).date),
      provider: str(obj(e).provider),
      summary: str(obj(e).summary),
    })),
  };
}

// The human approval gate for the migration import. The agent proposes records
// (dry run, nothing written); the clinician reviews counts, can open and edit
// any record (fixing skipped rows), and must approve before anything is
// inserted via POST /api/ai/import.
export function ImportPreviewCard({ data }: { data: ImportPreviewData }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("pending");
  const [result, setResult] = useState<{ created: number; failed: number } | null>(
    null,
  );
  // Working set of records (editable). Older threads may lack `records`; fall
  // back to the valid set so the card still works.
  const [records, setRecords] = useState<unknown[]>(
    () => data.records ?? data.valid ?? [],
  );
  // index → errors for rows that still fail validation.
  const [invalid, setInvalid] = useState<
    { index: number; errors: string[] }[]
  >(() => data.invalid ?? []);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const invalidByIndex = useMemo(
    () => new Map(invalid.map((i) => [i.index, i.errors])),
    [invalid],
  );
  const validCount = records.length - invalidByIndex.size;

  // Re-validate the working set server-side after an edit.
  const revalidate = async (next: unknown[]) => {
    try {
      const res = await validateImport(next);
      setInvalid(res.invalid.map((i) => ({ index: i.index, errors: i.errors })));
    } catch {
      /* keep prior validation state */
    }
  };

  const saveEdit = (index: number, record: Patient) => {
    const next = records.map((r, i) => (i === index ? record : r));
    setRecords(next);
    setEditingIndex(null);
    void revalidate(next);
  };

  const approve = async () => {
    setStatus("committing");
    try {
      // Send the whole working set; the backend re-validates and skips any
      // still-invalid rows, returning created/failed.
      const res = await commitImport(records);
      setResult({ created: res.created.length, failed: res.failed.length });
      setStatus("done");
      setReviewOpen(false);
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
        {status === "pending" && records.length > 0 ? (
          <Button
            className="ml-auto"
            onClick={() => setReviewOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
            {t("chat.importCard.reviewEdit")}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          {t("chat.importCard.ready")}{" "}
          <strong className="tabular-nums">{validCount}</strong>
        </span>
        {invalidByIndex.size > 0 ? (
          <span className="flex items-center gap-1 text-warning-foreground">
            <AlertTriangle className="size-3.5" />
            {t("chat.importCard.skipped")}{" "}
            <strong className="tabular-nums">{invalidByIndex.size}</strong>
          </span>
        ) : null}
        <span className="text-muted-foreground">
          {t("chat.importCard.total")}{" "}
          <span className="tabular-nums">{records.length}</span>
        </span>
      </div>

      {invalidByIndex.size > 0 && status === "pending" ? (
        <p className="text-xs text-muted-foreground">
          {t("chat.importCard.fixHint")}
        </p>
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
            disabled={status === "committing" || validCount === 0}
            onClick={approve}
            size="sm"
          >
            {status === "committing"
              ? t("chat.importCard.importing")
              : t("chat.importCard.approve", { count: validCount })}
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

      {/* Review list: every parsed record, editable. */}
      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chat.importCard.reviewTitle")}</DialogTitle>
            <DialogDescription>
              {t("chat.importCard.reviewDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {records.map((rec, index) => {
              const errors = invalidByIndex.get(index);
              const name =
                str((rec as Record<string, unknown>).name) ||
                t("chat.importCard.unnamed");
              return (
                <button
                  className="flex items-start gap-2 rounded-xl border bg-card/30 p-3 text-left transition-colors hover:bg-accent"
                  key={index}
                  onClick={() => setEditingIndex(index)}
                  type="button"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {name}
                    </span>
                    {errors ? (
                      <span className="mt-0.5 flex items-center gap-1 text-warning-foreground text-xs">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="truncate">{errors[0]}</span>
                      </span>
                    ) : (
                      <span className="mt-0.5 text-muted-foreground text-xs">
                        {t("chat.importCard.rowReady")}
                      </span>
                    )}
                  </div>
                  {errors ? (
                    <Badge variant="outline">
                      {t("chat.importCard.needsFix")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {t("chat.importCard.ready")}
                    </Badge>
                  )}
                  <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("chat.importCard.reviewClose")}
            </DialogClose>
            <Button
              disabled={status === "committing" || validCount === 0}
              onClick={approve}
              type="button"
            >
              {t("chat.importCard.approve", { count: validCount })}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Edit one record in the full patient form (review mode — no write). */}
      {editingIndex !== null ? (
        <PatientFormDialog
          key={editingIndex}
          mode="edit"
          onDraft={(record) => saveEdit(editingIndex, record)}
          onOpenChange={(o) => {
            if (!o) setEditingIndex(null);
          }}
          open={editingIndex !== null}
          patient={toPatientDraft(records[editingIndex])}
        />
      ) : null}
    </Card>
  );
}
