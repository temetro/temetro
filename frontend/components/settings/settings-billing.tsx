"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CopyField,
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";

export function SigningPanel() {
  return (
    <>
      <SettingsCard className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight">Signing key</h3>
            <Badge className="bg-emerald-500/15 text-emerald-400">Active</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Every change you make to a patient record is signed with this key, so patients
            can verify it came from you before approving it.
          </p>
          <Button className={cn("rounded-lg", whiteButton)}>Rotate key</Button>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-semibold tracking-tight">Ed25519</p>
          <p className="text-sm text-muted-foreground">Created May 28, 2026</p>
        </div>
      </SettingsCard>

      <SettingsSection
        description="The public key patients use to verify your signatures"
        title="Signing identity"
      >
        <SettingsCard className="p-5">
          <CopyField
            description="Share or publish this fingerprint so patients can trust your changes"
            label="Public key fingerprint"
            value="ed25519:9f86 d081 884c 7d65 9a2f eaa0 c55a d015"
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description="Changes you've signed that are waiting on the patient's approval"
        title="Signed records"
      >
        <SettingsCard className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground">No pending signatures</p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
