"use client";

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CopyField,
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";

export function SigningPanel() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsCard className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight">
              {t("settings.signing.keyTitle")}
            </h3>
            <Badge className="bg-emerald-500/15 text-emerald-400">
              {t("settings.signing.active")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.signing.keyDescription")}
          </p>
          <Button className={cn("rounded-lg", whiteButton)}>
            {t("settings.signing.rotateKey")}
          </Button>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-semibold tracking-tight">Ed25519</p>
          <p className="text-sm text-muted-foreground">
            {t("settings.signing.createdAt")}
          </p>
        </div>
      </SettingsCard>

      <SettingsSection
        description={t("settings.signing.identityDescription")}
        title={t("settings.signing.identityTitle")}
      >
        <SettingsCard className="p-5">
          <CopyField
            description={t("settings.signing.fingerprintDescription")}
            label={t("settings.signing.fingerprintLabel")}
            value="ed25519:9f86 d081 884c 7d65 9a2f eaa0 c55a d015"
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.howItWorksDescription")}
        title={t("settings.signing.howItWorksTitle")}
      >
        <SettingsCard className="divide-y divide-border">
          {(["sign", "approve", "verify"] as const).map((step, index) => (
            <div className="flex items-start gap-3 px-4 py-3.5" key={step}>
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t(`settings.signing.steps.${step}`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`settings.signing.steps.${step}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.backupDescription")}
        title={t("settings.signing.backupTitle")}
      >
        <SettingsCard className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings.signing.backupLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.signing.backupDesc")}
            </p>
          </div>
          <Badge variant="secondary">{t("settings.signing.comingSoon")}</Badge>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.signedRecordsDescription")}
        title={t("settings.signing.signedRecordsTitle")}
      >
        <SettingsCard className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground">
            {t("settings.signing.noPending")}
          </p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
