"use client";

import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EarningsChart } from "@/components/analysis/earnings-chart";
import { Card } from "@/components/ui/card";
import type { Analytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/invoices";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-foreground text-sm tabular-nums">
        {value}
      </span>
    </div>
  );
}

// The agent's analytics card: clinic KPIs + earnings, with a Bklit earnings
// chart (reused from the Analysis page).
export function AnalyticsCard({ data }: { data: Analytics }) {
  const { t } = useTranslation();
  return (
    <Card className="w-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.analyticsCard.title")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("chat.analyticsCard.patients")}
          value={String(data.patients.total)}
        />
        <Stat
          label={t("chat.analyticsCard.appointmentsThisWeek")}
          value={String(data.appointments.thisWeek)}
        />
        <Stat
          label={t("chat.analyticsCard.activePrescriptions")}
          value={String(data.prescriptions.active)}
        />
        <Stat
          label={t("chat.analyticsCard.openTasks")}
          value={String(data.tasks.open)}
        />
        <Stat
          label={t("chat.analyticsCard.billed")}
          value={formatMoney(data.earnings.totalBilled)}
        />
        <Stat
          label={t("chat.analyticsCard.paid")}
          value={formatMoney(data.earnings.totalPaid)}
        />
        <Stat
          label={t("chat.analyticsCard.outstanding")}
          value={formatMoney(data.earnings.totalOutstanding)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">
          {t("chat.analyticsCard.byMonth")}
        </span>
        <EarningsChart data={data.earnings.byMonth} />
      </div>
    </Card>
  );
}
