"use client";

import { Database, Download, Import, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";

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
              <Button disabled size="sm" variant="outline">
                {t("settings.records.export")}
              </Button>
            }
            title={t("settings.records.export")}
          />
          <RecordRow
            description={t("settings.records.importDesc")}
            icon={<Import className="size-4" />}
            right={comingSoon}
            title={t("settings.records.import")}
          />
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
