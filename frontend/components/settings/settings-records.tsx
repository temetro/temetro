"use client";

import { Database, Download, Import, Smartphone } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import {
  downloadJson,
  exportRecords,
  importRecords,
  type RecordsExport,
} from "@/lib/records";
import { notify } from "@/lib/toast";

// A single titled row inside a records card: icon + title/description on the
// left, a status badge or action on the right.
function RecordRow({
  icon,
  title,
  description,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

export function RecordsPanel() {
  const { t } = useTranslation();
  const comingSoon = (
    <Badge variant="secondary">{t("settings.records.comingSoon")}</Badge>
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  // A parsed archive staged for import (preview before applying).
  const [staged, setStaged] = useState<{ name: string; count: number; patients: unknown[] } | null>(
    null,
  );

  const runExport = async () => {
    setExporting(true);
    try {
      const data = await exportRecords();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(data, `temetro-records-${stamp}.json`);
      notify.success(
        t("settings.records.exportDoneTitle"),
        t("settings.records.exportDoneBody", { count: data.patientCount }),
      );
    } catch {
      notify.error(
        t("settings.records.exportFailedTitle"),
        t("settings.records.exportFailedBody"),
      );
    } finally {
      setExporting(false);
    }
  };

  const onFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as RecordsExport;
      const patients = Array.isArray(parsed?.patients) ? parsed.patients : null;
      if (!patients) throw new Error("bad");
      setStaged({ name: file.name, count: patients.length, patients });
    } catch {
      setStaged(null);
      notify.error(
        t("settings.records.importInvalidTitle"),
        t("settings.records.importInvalidBody"),
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = async () => {
    if (!staged) return;
    setImporting(true);
    try {
      const result = await importRecords(staged.patients);
      notify.success(
        t("settings.records.importDoneTitle"),
        t("settings.records.importDoneBody", {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      setStaged(null);
    } catch {
      notify.error(
        t("settings.records.importFailedTitle"),
        t("settings.records.importFailedBody"),
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <SettingsSection
        description={t("settings.records.sourcesDescription")}
        title={t("settings.records.sourcesTitle")}
      >
        <SettingsCard className="divide-y divide-border">
          <RecordRow
            description={t("settings.records.clinicDbDesc")}
            icon={<Database className="size-4" />}
            right={
              <Badge className="bg-emerald-500/15 text-emerald-400">
                {t("settings.records.connected")}
              </Badge>
            }
            title={t("settings.records.clinicDb")}
          />
          <RecordRow
            description={t("settings.records.patientStorageDesc")}
            icon={<Smartphone className="size-4" />}
            right={comingSoon}
            title={t("settings.records.patientStorage")}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.records.importExportDescription")}
        title={t("settings.records.importExportTitle")}
      >
        <SettingsCard className="divide-y divide-border">
          <RecordRow
            description={t("settings.records.exportDesc")}
            icon={<Download className="size-4" />}
            right={
              <Button
                disabled={exporting}
                onClick={runExport}
                size="sm"
                variant="outline"
              >
                {exporting
                  ? t("settings.records.exporting")
                  : t("settings.records.export")}
              </Button>
            }
            title={t("settings.records.export")}
          />
          <RecordRow
            description={t("settings.records.importTemetroDesc")}
            icon={<Import className="size-4" />}
            right={
              <>
                <input
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                  ref={fileRef}
                  type="file"
                />
                <Button
                  onClick={() => fileRef.current?.click()}
                  size="sm"
                  variant="outline"
                >
                  {t("settings.records.importChoose")}
                </Button>
              </>
            }
            title={t("settings.records.importTemetro")}
          />
          {staged ? (
            <div className="flex items-center justify-between gap-4 bg-muted/30 px-4 py-3.5">
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium">{staged.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.records.importPreview", { count: staged.count })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  disabled={importing}
                  onClick={() => setStaged(null)}
                  size="sm"
                  variant="ghost"
                >
                  {t("settings.records.importCancel")}
                </Button>
                <Button disabled={importing} onClick={runImport} size="sm">
                  {importing
                    ? t("settings.records.importing")
                    : t("settings.records.importApply")}
                </Button>
              </div>
            </div>
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.records.retentionDescription")}
        title={t("settings.records.retentionTitle")}
      >
        <SettingsCard className="p-5">
          <p className="text-sm text-muted-foreground">
            {t("settings.records.retentionBody")}
          </p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
