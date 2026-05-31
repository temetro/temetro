"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { BillingPanel } from "@/components/settings/settings-billing";
import { PreferencesPanel } from "@/components/settings/settings-preferences";

const TABS = [
  "Preferences",
  "Billing",
  "Members",
  "Webhooks",
  "Custom Fields",
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
  const [tab, setTab] = useState<Tab>("Preferences");

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
        {tab === "Preferences" && <PreferencesPanel />}
        {tab === "Billing" && <BillingPanel />}
        {tab === "Members" && (
          <PlaceholderPanel
            description="Invite and manage members of your organization"
            title="Members"
          />
        )}
        {tab === "Webhooks" && (
          <PlaceholderPanel
            description="Send event notifications to your own endpoints"
            title="Webhooks"
          />
        )}
        {tab === "Custom Fields" && (
          <PlaceholderPanel
            description="Collect additional information from your customers"
            title="Custom Fields"
          />
        )}
      </div>
    </div>
  );
}
