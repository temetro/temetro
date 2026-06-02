"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { SigningPanel } from "@/components/settings/settings-billing";
import { CareTeamPanel } from "@/components/settings/settings-care-team";
import { ProfilePanel } from "@/components/settings/settings-preferences";

const TABS = [
  "Profile",
  "Records",
  "Signing",
  "Care team",
  "Developers",
] as const;

type Tab = (typeof TABS)[number];

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <SettingsSection description={description} title={title}>
      <SettingsCard className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      </SettingsCard>
    </SettingsSection>
  );
}

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{tab}</h1>
        <nav className="flex flex-wrap items-center gap-1">
          {TABS.map((item) => (
            <button
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === item
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-10 space-y-12">
        {tab === "Profile" && <ProfilePanel />}
        {tab === "Records" && (
          <PlaceholderPanel
            description="How patient records are sourced, stored, and displayed"
            title="Records"
          />
        )}
        {tab === "Signing" && <SigningPanel />}
        {tab === "Care team" && <CareTeamPanel />}
        {tab === "Developers" && (
          <PlaceholderPanel
            description="Access tokens for the temetro API"
            title="Developers"
          />
        )}
      </div>
    </div>
  );
}
