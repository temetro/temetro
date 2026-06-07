"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CopyField,
  FieldLabel,
  SettingsCard,
  SettingsSection,
  ToggleRow,
} from "@/components/settings/settings-parts";

// Keys into settings.profile.notif.* — these toggles are illustrative.
const patientNotifications = [
  { titleKey: "newLab", descKey: "newLabDesc" },
  { titleKey: "recordUpdated", descKey: "recordUpdatedDesc" },
  { titleKey: "approvalRequested", descKey: "approvalRequestedDesc" },
  { titleKey: "changeApproved", descKey: "changeApprovedDesc" },
  { titleKey: "newMessage", descKey: "newMessageDesc" },
  { titleKey: "visitScheduled", descKey: "visitScheduledDesc" },
] as const;

export function ProfilePanel() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsSection title={t("settings.profile.sectionTitle")}>
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description={t("settings.profile.clinicianIdDescription")}
            label={t("settings.profile.clinicianIdLabel")}
            value="62a5278f-91c6-4912-b711-ee1c9c2f0a73"
          />
          <CopyField
            description={t("settings.profile.handleDescription")}
            label={t("settings.profile.handleLabel")}
            value="dr-khalid"
          />

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <FieldLabel>{t("settings.profile.avatar")}</FieldLabel>
              <Avatar className="size-10 rounded-xl">
                <AvatarFallback className="rounded-xl bg-muted text-sm font-medium">
                  K
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-1.5">
              <FieldLabel required>
                {t("settings.profile.displayName")}
              </FieldLabel>
              <Input defaultValue="Dr. Khalid" />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>{t("settings.profile.specialty")}</FieldLabel>
            <button
              className="flex h-9 w-full items-center justify-between rounded-3xl bg-input/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-input/70"
              type="button"
            >
              {t("settings.profile.selectSpecialty")}
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>{t("settings.profile.clinic")}</FieldLabel>
              <Input placeholder={t("settings.profile.clinicPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>
                {t("settings.profile.contactEmail")}
              </FieldLabel>
              <Input
                placeholder={t("settings.profile.contactEmailPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <FieldLabel>{t("settings.profile.professionalLinks")}</FieldLabel>
              <p className="text-xs text-muted-foreground">
                {t("settings.profile.professionalLinksHint")}
              </p>
            </div>
            <Button className="rounded-lg" size="sm" variant="outline">
              <Plus className="size-4" />
              {t("settings.profile.addLink")}
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.profile.patientNotificationsDescription")}
        title={t("settings.profile.patientNotifications")}
      >
        <div className="space-y-3">
          {patientNotifications.map((item) => (
            <ToggleRow
              defaultChecked
              description={t(`settings.profile.notif.${item.descKey}`)}
              key={item.titleKey}
              title={t(`settings.profile.notif.${item.titleKey}`)}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        description={t("settings.profile.accountNotificationsDescription")}
        title={t("settings.profile.accountNotifications")}
      >
        <div className="space-y-3">
          <ToggleRow
            defaultChecked
            description={t("settings.profile.notif.pendingApprovalsDesc")}
            title={t("settings.profile.notif.pendingApprovals")}
          />
          <ToggleRow
            defaultChecked
            description={t("settings.profile.notif.recordsSharedDesc")}
            title={t("settings.profile.notif.recordsShared")}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description={t("settings.profile.featuresDescription")}
        title={t("settings.profile.features")}
      >
        <div className="space-y-3">
          <ToggleRow
            description={t("settings.profile.notif.patientStorageDesc")}
            title={t("settings.profile.notif.patientStorage")}
          />
          <ToggleRow
            description={t("settings.profile.notif.requireSignedDesc")}
            title={t("settings.profile.notif.requireSigned")}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description={t("settings.profile.dangerZoneDescription")}
        title={t("settings.profile.dangerZone")}
      >
        <SettingsCard className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings.profile.deleteAccount")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.profile.deleteAccountDescription")}
            </p>
          </div>
          <Button variant="destructive">{t("settings.profile.delete")}</Button>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
