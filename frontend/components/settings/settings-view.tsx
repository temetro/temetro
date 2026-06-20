"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { AIPanel } from "@/components/settings/settings-ai";
import { SigningPanel } from "@/components/settings/settings-billing";
import { CareTeamPanel } from "@/components/settings/settings-care-team";
import { DevelopersPanel } from "@/components/settings/settings-developers";
import { IntegrationsPanel } from "@/components/settings/settings-integrations";
import { ProfilePanel } from "@/components/settings/settings-preferences";
import { RecordsPanel } from "@/components/settings/settings-records";
import { useActiveRole } from "@/lib/roles";

const TABS = [
  { id: "profile", labelKey: "settings.tabs.profile" },
  { id: "ai", labelKey: "settings.tabs.ai" },
  { id: "records", labelKey: "settings.tabs.records" },
  { id: "signing", labelKey: "settings.tabs.signing" },
  { id: "careTeam", labelKey: "settings.tabs.careTeam" },
  { id: "integrations", labelKey: "settings.tabs.integrations" },
  { id: "developers", labelKey: "settings.tabs.developers" },
] as const;

// Per-user tabs every clinician sees; the rest are clinic-wide (admin only).
const PERSONAL_TABS = ["profile", "ai"];

type Tab = (typeof TABS)[number]["id"];

export function SettingsView() {
  const { t } = useTranslation();
  const role = useActiveRole();
  const searchParams = useSearchParams();
  // Deep-link support: /settings?tab=careTeam&member=<userId>.
  const urlTab = searchParams.get("tab") as Tab | null;
  const urlMember = searchParams.get("member");
  const [tab, setTab] = useState<Tab>(urlTab ?? "profile");

  // Only clinic owners/admins manage clinic-wide settings (care team, records,
  // signing, developers). Everyone else gets their personal tabs (profile, AI).
  const isAdmin = role === "owner" || role === "admin";
  const visibleTabs = isAdmin
    ? TABS
    : TABS.filter((item) => PERSONAL_TABS.includes(item.id));
  const activeTab = visibleTabs.some((item) => item.id === tab) ? tab : "profile";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(`settings.tabs.${activeTab}`)}
        </h1>
        <nav className="-mx-1 flex flex-nowrap items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map((item) => (
            <button
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
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
        {activeTab === "ai" && <AIPanel />}
        {activeTab === "records" && <RecordsPanel />}
        {activeTab === "signing" && <SigningPanel />}
        {activeTab === "careTeam" && (
          <CareTeamPanel initialMemberId={urlMember ?? undefined} />
        )}
        {activeTab === "integrations" && <IntegrationsPanel />}
        {activeTab === "developers" && <DevelopersPanel />}
      </div>
    </div>
  );
}
