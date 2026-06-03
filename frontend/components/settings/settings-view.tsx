"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { SigningPanel } from "@/components/settings/settings-billing";
import { CareTeamPanel } from "@/components/settings/settings-care-team";
import { ProfilePanel } from "@/components/settings/settings-preferences";

const TABS = [
  { id: "profile", labelKey: "settings.tabs.profile" },
  { id: "records", labelKey: "settings.tabs.records" },
  { id: "signing", labelKey: "settings.tabs.signing" },
  { id: "careTeam", labelKey: "settings.tabs.careTeam" },
  { id: "developers", labelKey: "settings.tabs.developers" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useTranslation();
  return (
    <SettingsSection description={description} title={title}>
      <SettingsCard className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">{t("settings.empty")}</p>
      </SettingsCard>
    </SettingsSection>
  );
}

export function SettingsView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(`settings.tabs.${tab}`)}
        </h1>
        <nav className="flex flex-wrap items-center gap-1">
          {TABS.map((item) => (
            <button
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === item.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-10 space-y-12">
        {tab === "profile" && <ProfilePanel />}
        {tab === "records" && (
          <PlaceholderPanel
            description={t("settings.records.description")}
            title={t("settings.tabs.records")}
          />
        )}
        {tab === "signing" && <SigningPanel />}
        {tab === "careTeam" && <CareTeamPanel />}
        {tab === "developers" && (
          <PlaceholderPanel
            description={t("settings.developers.description")}
            title={t("settings.tabs.developers")}
          />
        )}
      </div>
    </div>
  );
}
