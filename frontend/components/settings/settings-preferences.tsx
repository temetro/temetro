"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import {
  CopyField,
  FieldLabel,
  SettingsCard,
  SettingsSection,
  ToggleRow,
} from "@/components/settings/settings-parts";
import { authClient } from "@/lib/auth-client";
import { supportedLanguages } from "@/lib/i18n/config";
import {
  getSettings,
  saveSettings,
  type UserPreferences,
} from "@/lib/settings";
import { notify } from "@/lib/toast";

// Keys into settings.profile.notif.* — each maps to a persisted preference.
const patientNotifications = [
  { titleKey: "newLab", descKey: "newLabDesc" },
  { titleKey: "recordUpdated", descKey: "recordUpdatedDesc" },
  { titleKey: "approvalRequested", descKey: "approvalRequestedDesc" },
  { titleKey: "changeApproved", descKey: "changeApprovedDesc" },
  { titleKey: "newMessage", descKey: "newMessageDesc" },
  { titleKey: "visitScheduled", descKey: "visitScheduledDesc" },
] as const;

const accountNotifications = [
  { titleKey: "pendingApprovals", descKey: "pendingApprovalsDesc" },
  { titleKey: "recordsShared", descKey: "recordsSharedDesc" },
] as const;

// All notification toggles default to on; profile extras default to empty.
const DEFAULT_PREFS: UserPreferences = {
  "notif.newLab": true,
  "notif.recordUpdated": true,
  "notif.approvalRequested": true,
  "notif.changeApproved": true,
  "notif.newMessage": true,
  "notif.visitScheduled": true,
  "notif.pendingApprovals": true,
  "notif.recordsShared": true,
  clinic: "",
  contactEmail: "",
};

export function ProfilePanel() {
  const { t, i18n } = useTranslation();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // The active UI language — `i18n.changeLanguage` persists the choice to
  // localStorage (the detector's cache), so it survives reloads.
  const activeLang = i18n.resolvedLanguage ?? i18n.language;

  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [baseline, setBaseline] = useState<UserPreferences>(DEFAULT_PREFS);
  const [name, setName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((stored) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_PREFS, ...stored };
        setPrefs(merged);
        setBaseline(merged);
      })
      .catch(() => {
        // Keep the defaults; the page still works and Save will retry.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the display name from the session once it loads.
  useEffect(() => {
    if (user?.name) {
      setName((prev) => prev || user.name);
      setBaselineName((prev) => prev || user.name);
    }
  }, [user?.name]);

  const setPref = (key: string, value: boolean | string) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  const dirty =
    name !== baselineName || JSON.stringify(prefs) !== JSON.stringify(baseline);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveSettings(prefs);
      const trimmed = name.trim();
      if (trimmed && trimmed !== baselineName) {
        const { error } = await authClient.updateUser({ name: trimmed });
        if (error) throw new Error(error.message ?? "updateUser failed");
        setName(trimmed);
        setBaselineName(trimmed);
      }
      const merged = { ...DEFAULT_PREFS, ...saved };
      setPrefs(merged);
      setBaseline(merged);
      notify.success(
        t("settings.profile.savedTitle"),
        t("settings.profile.savedBody"),
      );
    } catch {
      notify.error(
        t("settings.profile.saveFailedTitle"),
        t("settings.profile.saveFailedBody"),
      );
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.name || "?").trim().charAt(0).toUpperCase();
  const username =
    (user as { username?: string | null } | undefined)?.username ?? null;

  return (
    <>
      <SettingsSection title={t("settings.profile.sectionTitle")}>
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description={t("settings.profile.clinicianIdDescription")}
            label={t("settings.profile.clinicianIdLabel")}
            value={user?.id ?? "—"}
          />
          <CopyField
            description={t("settings.profile.handleDescription")}
            label={t("settings.profile.handleLabel")}
            value={username ?? user?.email ?? "—"}
          />

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <FieldLabel>{t("settings.profile.avatar")}</FieldLabel>
              <Avatar className="size-10 rounded-xl">
                <AvatarFallback className="rounded-xl bg-muted text-sm font-medium">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-1.5">
              <FieldLabel required>
                {t("settings.profile.displayName")}
              </FieldLabel>
              <Input
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
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
              <Input
                onChange={(event) => setPref("clinic", event.target.value)}
                placeholder={t("settings.profile.clinicPlaceholder")}
                value={String(prefs.clinic ?? "")}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>
                {t("settings.profile.contactEmail")}
              </FieldLabel>
              <Input
                onChange={(event) =>
                  setPref("contactEmail", event.target.value)
                }
                placeholder={t("settings.profile.contactEmailPlaceholder")}
                value={String(prefs.contactEmail ?? "")}
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
        description={t("settings.profile.language.description")}
        title={t("settings.profile.language.title")}
      >
        <SettingsCard className="space-y-1.5 p-5">
          <FieldLabel>{t("settings.profile.language.label")}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {supportedLanguages.map((lng) => (
              <Button
                aria-pressed={activeLang === lng}
                className="rounded-3xl"
                key={lng}
                onClick={() => void i18n.changeLanguage(lng)}
                size="sm"
                type="button"
                variant={activeLang === lng ? "default" : "outline"}
              >
                {t(`settings.profile.language.${lng}`)}
              </Button>
            ))}
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
              checked={Boolean(prefs[`notif.${item.titleKey}`])}
              description={t(`settings.profile.notif.${item.descKey}`)}
              key={item.titleKey}
              onCheckedChange={(checked) =>
                setPref(`notif.${item.titleKey}`, checked)
              }
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
          {accountNotifications.map((item) => (
            <ToggleRow
              checked={Boolean(prefs[`notif.${item.titleKey}`])}
              description={t(`settings.profile.notif.${item.descKey}`)}
              key={item.titleKey}
              onCheckedChange={(checked) =>
                setPref(`notif.${item.titleKey}`, checked)
              }
              title={t(`settings.profile.notif.${item.titleKey}`)}
            />
          ))}
        </div>
      </SettingsSection>

      {/* Future features — intentionally not wired to persistence yet. */}
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
          <Button onClick={() => setDeleteOpen(true)} variant="destructive">
            {t("settings.profile.delete")}
          </Button>
        </SettingsCard>
      </SettingsSection>

      <DeleteAccountDialog onOpenChange={setDeleteOpen} open={deleteOpen} />

      {dirty ? (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-sm text-muted-foreground">
              {t("settings.profile.unsavedChanges")}
            </p>
            <Button disabled={saving} onClick={save} size="sm">
              {saving
                ? t("settings.profile.saving")
                : t("settings.profile.saveChanges")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
