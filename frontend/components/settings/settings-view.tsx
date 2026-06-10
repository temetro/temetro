"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { SigningPanel } from "@/components/settings/settings-billing";
import { CareTeamPanel } from "@/components/settings/settings-care-team";
import { DevelopersPanel } from "@/components/settings/settings-developers";
import { ProfilePanel } from "@/components/settings/settings-preferences";
import { RecordsPanel } from "@/components/settings/settings-records";
import { useActiveRole } from "@/lib/roles";

const TABS = [
  { id: "profile", labelKey: "settings.tabs.profile" },
  { id: "records", labelKey: "settings.tabs.records" },
  { id: "signing", labelKey: "settings.tabs.signing" },
  { id: "careTeam", labelKey: "settings.tabs.careTeam" },
  { id: "developers", labelKey: "settings.tabs.developers" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function SettingsView() {
  const { t } = useTranslation();
  const role = useActiveRole();
  const [tab, setTab] = useState<Tab>("profile");

  // Only clinic owners/admins manage clinic-wide settings (care team, records,
  // signing, developers). Everyone else gets their own profile only.
  const isAdmin = role === "owner" || role === "admin";
  const visibleTabs = isAdmin ? TABS : TABS.filter((item) => item.id === "profile");
  const activeTab = visibleTabs.some((item) => item.id === tab) ? tab : "profile";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(`settings.tabs.${activeTab}`)}
        </h1>
        <nav className="flex flex-wrap items-center gap-1">
          {visibleTabs.map((item) => (
            <button
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                activeTab === item.id
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
        {activeTab === "profile" && <ProfilePanel />}
        {activeTab === "records" && <RecordsPanel />}
        {activeTab === "signing" && <SigningPanel />}
        {activeTab === "careTeam" && <CareTeamPanel />}
        {activeTab === "developers" && <DevelopersPanel />}
      </div>
    </div>
  );
}
