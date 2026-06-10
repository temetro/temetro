"use client";

import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CopyField,
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { API_BASE_URL } from "@/lib/api-client";

export function DevelopersPanel() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsSection
        description={t("settings.developers.apiDescription")}
        title={t("settings.developers.apiTitle")}
      >
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description={t("settings.developers.baseUrlDescription")}
            label={t("settings.developers.baseUrlLabel")}
            value={API_BASE_URL}
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings.developers.authLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.developers.authDescription")}
            </p>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        action={
          <Badge variant="secondary">
            {t("settings.developers.comingSoon")}
          </Badge>
        }
        description={t("settings.developers.tokensDescription")}
        title={t("settings.developers.tokensTitle")}
      >
        <SettingsCard className="flex flex-col items-center justify-center gap-3 p-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <KeyRound className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.developers.noTokens")}
          </p>
          <Button disabled size="sm" variant="outline">
            {t("settings.developers.generateToken")}
          </Button>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.developers.resourcesDescription")}
        title={t("settings.developers.resourcesTitle")}
      >
        <SettingsCard className="p-5">
          <p className="text-sm text-muted-foreground">
            {t("settings.developers.resourcesBody")}
          </p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
