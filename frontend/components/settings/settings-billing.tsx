"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";

export function BillingPanel() {
  return (
    <>
      <SettingsCard className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight">Early Member</h3>
            <Badge className="bg-emerald-500/15 text-emerald-400">Active</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            For our founding community of early members.
          </p>
          <Button className={cn("rounded-lg", whiteButton)}>Change plan</Button>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-semibold tracking-tight">Free</p>
          <p className="text-sm text-muted-foreground">
            4.00% + $0.40 per transaction
          </p>
        </div>
      </SettingsCard>

      <SettingsSection
        action={
          <Button className="rounded-lg" variant="secondary">
            Add payment method
          </Button>
        }
        description="Cards used to pay for your temetro subscription"
        title="Payment methods"
      >
        <SettingsCard className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground">No payment methods on file</p>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        action={
          <Button className="rounded-lg" variant="secondary">
            Edit
          </Button>
        }
        description="Used on invoices for your temetro subscription"
        title="Billing address"
      >
        <SettingsCard className="p-5">
          <p className="text-sm">khalid</p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
