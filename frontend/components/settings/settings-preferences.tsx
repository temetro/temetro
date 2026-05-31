"use client";

import { ChevronDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CopyField,
  FieldLabel,
  SettingsCard,
  SettingsSection,
  ToggleRow,
  whiteButton,
} from "@/components/settings/settings-parts";

const customerNotifications = [
  {
    title: "Order confirmation",
    description: "Sent when a customer completes a one-time purchase",
  },
  {
    title: "Subscription confirmation",
    description: "Sent when a customer starts a new subscription",
  },
  {
    title: "Subscription cycled",
    description: "Sent when a subscription automatically renews",
  },
  {
    title: "Trial converted",
    description: "Sent when a trial ends and the subscription becomes paid",
  },
  {
    title: "Renewal reminder",
    description: "Sent 7 days before a subscription with a long billing cycle renews",
  },
  {
    title: "Trial conversion reminder",
    description: "Sent before a trial ends and converts to a paid subscription",
  },
  {
    title: "Subscription updated",
    description: "Sent when a customer changes their subscription to a different product",
  },
];

export function PreferencesPanel() {
  return (
    <>
      <SettingsSection title="Organization">
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description="Unique identifier for your organization"
            label="Identifier"
            value="62a5278f-91c6-4912-b711-ee1c9c2f0a73"
          />
          <CopyField
            description="Used for Customer Portal, Transaction Statements, etc."
            label="Organization Slug"
            value="khalid"
          />

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Logo</FieldLabel>
              <Avatar className="size-10 rounded-xl" size="lg">
                <AvatarFallback className="rounded-xl bg-muted text-sm font-medium">
                  K
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-1.5">
              <FieldLabel required>Organization Name</FieldLabel>
              <Input defaultValue="khalid" />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Country</FieldLabel>
            <button
              className="flex h-9 w-full items-center justify-between rounded-3xl bg-input/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-input/70"
              type="button"
            >
              Select country
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Website</FieldLabel>
              <Input placeholder="https://acme.com" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Support Email</FieldLabel>
              <Input placeholder="support@acme.com" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <FieldLabel>Social Media</FieldLabel>
              <p className="text-xs text-muted-foreground">
                Your personal social media links are used for identity verification. They
                will never be shown publicly.
              </p>
            </div>
            <Button className="rounded-lg" size="sm" variant="outline">
              <Plus className="size-4" />
              Add Social
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description="Emails automatically sent to customers for purchases, renewals, and other subscription lifecycle events"
        title="Customer notifications"
      >
        <div className="space-y-3">
          {customerNotifications.map((item) => (
            <ToggleRow
              defaultChecked
              description={item.description}
              key={item.title}
              title={item.title}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        description="Emails sent to members of your organization for account and product activity"
        title="Account notifications"
      >
        <div className="space-y-3">
          <ToggleRow
            defaultChecked
            description="Send a notification when new orders are created"
            title="New Orders"
          />
          <ToggleRow
            defaultChecked
            description="Send a notification when new subscriptions are created"
            title="New Subscriptions"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description="Manage alpha & beta features for your organization"
        title="Features"
      >
        <div className="space-y-3">
          <ToggleRow
            description="Show translated checkouts to your customers"
            title="Localized Checkout"
          />
          <ToggleRow
            description="Enable seat-based pricing for subscription products. Requires the member model to be enabled."
            title="Seat-Based Billing"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description="Manage access tokens to authenticate with the temetro API"
        title="Developers"
      >
        <SettingsCard className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any active organization access tokens.
          </p>
          <Button className={cn("rounded-lg", whiteButton)} size="sm">
            Create token
          </Button>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description="Irreversible actions for this organization"
        title="Danger Zone"
      >
        <SettingsCard className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete Organization</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete this organization and all associated data. This action
              cannot be undone.
            </p>
          </div>
          <Button className="rounded-lg bg-destructive text-white hover:bg-destructive/90">
            Delete
          </Button>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
