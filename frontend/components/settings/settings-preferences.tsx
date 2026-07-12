"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { persistLanguage } from "@/lib/language";
import { SPECIALTIES, specialtyLabel } from "@/lib/staff";
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
  specialty: "",
  // Professional links stored as a JSON array string (values are boolean|string).
  links: "",
};

// Parse the stored `links` preference (a JSON array string) into an array.
function parseLinks(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

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
  // A language picked in the Select but not yet applied — its presence opens the
  // confirmation dialog. The Select stays bound to `activeLang`, so cancelling
  // (clearing this) automatically reverts the shown selection.
  const [pendingLang, setPendingLang] = useState<string | null>(null);

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

  const links = parseLinks(prefs.links);
  const setLinks = (next: string[]) =>
    setPref("links", JSON.stringify(next));

  const dirty =
    name !== baselineName || JSON.stringify(prefs) !== JSON.stringify(baseline);

  const save = async () => {
    setSaving(true);
    try {
      // Drop blank link rows before persisting.
      const cleanedLinks = links.map((l) => l.trim()).filter(Boolean);
      const toSave: UserPreferences = {
        ...prefs,
        links: cleanedLinks.length ? JSON.stringify(cleanedLinks) : "",
      };
      const saved = await saveSettings(toSave);
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
            <Select
              onValueChange={(value) => setPref("specialty", value ?? "")}
              value={String(prefs.specialty ?? "")}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value: string) =>
                    value ? (
                      specialtyLabel(t, value)
                    ) : (
                      <span className="text-muted-foreground">
                        {t("settings.profile.selectSpecialty")}
                      </span>
                    )
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`settings.careTeam.specialties.${s}`)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
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
            {links.length > 0 ? (
              <div className="space-y-2">
                {links.map((link, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  <div className="flex items-center gap-2" key={index}>
                    <Input
                      inputMode="url"
                      onChange={(event) =>
                        setLinks(
                          links.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        )
                      }
                      placeholder={t("settings.profile.linkPlaceholder")}
                      value={link}
                    />
                    <Button
                      aria-label={t("settings.profile.removeLink")}
                      onClick={() =>
                        setLinks(links.filter((_, i) => i !== index))
                      }
                      size="icon-sm"
                      variant="ghost"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              className="rounded-lg"
              onClick={() => setLinks([...links, ""])}
              size="sm"
              variant="outline"
            >
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
          <Select
            onValueChange={(value) => {
              if (value !== activeLang) setPendingLang(value);
            }}
            value={activeLang}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {supportedLanguages.map((lng) => (
                <SelectItem key={lng} value={lng}>
                  {t(`settings.profile.language.${lng}`)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
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

      <ConfirmDialog
        cancelLabel={t("settings.profile.language.cancel")}
        confirmLabel={t("settings.profile.language.confirmCta")}
        description={
          pendingLang
            ? t("settings.profile.language.confirmBody", {
                language: t(`settings.profile.language.${pendingLang}`),
              })
            : undefined
        }
        onConfirm={() => {
          if (pendingLang) {
            void i18n.changeLanguage(pendingLang);
            void persistLanguage(pendingLang);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingLang(null);
        }}
        open={pendingLang !== null}
        title={t("settings.profile.language.confirmTitle")}
        variant="default"
      />

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
