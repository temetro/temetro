"use client";

import { ChevronDown, Plus } from "lucide-react";

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

const patientNotifications = [
  {
    title: "New lab result",
    description: "Sent when a new lab result is available on a patient's chart",
  },
  {
    title: "Record updated",
    description: "Sent when a patient's record is updated by a member of the care team",
  },
  {
    title: "Approval requested",
    description: "Sent when a signed change is awaiting the patient's approval",
  },
  {
    title: "Change approved",
    description: "Sent when a patient approves a pending change to their record",
  },
  {
    title: "New message",
    description: "Sent when a patient or another clinician sends a message",
  },
  {
    title: "Visit scheduled",
    description: "Sent when an upcoming visit is added to a patient's record",
  },
];

export function ProfilePanel() {
  return (
    <>
      <SettingsSection title="Clinician profile">
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description="Your unique clinician identifier, used when signing records"
            label="Clinician ID"
            value="62a5278f-91c6-4912-b711-ee1c9c2f0a73"
          />
          <CopyField
            description="Used in your public profile and the patient portal"
            label="Handle"
            value="dr-khalid"
          />

          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Avatar</FieldLabel>
              <Avatar className="size-10 rounded-xl" size="lg">
                <AvatarFallback className="rounded-xl bg-muted text-sm font-medium">
                  K
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-1.5">
              <FieldLabel required>Display name</FieldLabel>
              <Input defaultValue="Dr. Khalid" />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Specialty</FieldLabel>
            <button
              className="flex h-9 w-full items-center justify-between rounded-3xl bg-input/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-input/70"
              type="button"
            >
              Select specialty
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Clinic / practice</FieldLabel>
              <Input placeholder="e.g. Main Hospital" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Contact email</FieldLabel>
              <Input placeholder="clinician@example.org" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <FieldLabel>Professional links</FieldLabel>
              <p className="text-xs text-muted-foreground">
                Registry or institutional profiles used to verify your identity. They are
                never shown to patients.
              </p>
            </div>
            <Button className="rounded-lg" size="sm" variant="outline">
              <Plus className="size-4" />
              Add link
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description="Emails sent to patients about their records, results, and pending approvals"
        title="Patient notifications"
      >
        <div className="space-y-3">
          {patientNotifications.map((item) => (
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
        description="Notifications sent to you about your patients and the care team"
        title="Account notifications"
      >
        <div className="space-y-3">
          <ToggleRow
            defaultChecked
            description="Notify me when a patient approves or rejects a pending change"
            title="Pending approvals"
          />
          <ToggleRow
            defaultChecked
            description="Notify me when a patient shares a record with me"
            title="Records shared with me"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description="Manage alpha & beta features for your account"
        title="Features"
      >
        <div className="space-y-3">
          <ToggleRow
            description="Write records to the patient's own device instead of your database"
            title="Patient-owned storage (beta)"
          />
          <ToggleRow
            description="Require a signature on every change you make to a patient record"
            title="Require signed records"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        description="Irreversible actions for your account"
        title="Danger Zone"
      >
        <SettingsCard className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your temetro account and any locally stored signing
              keys. This action cannot be undone.
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
