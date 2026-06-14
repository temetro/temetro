"use client";

import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import type { ClinicCardData } from "@/lib/ai-chat";

// Small card the agent shows for getClinicInfo.
export function ClinicCard({ data }: { data: ClinicCardData }) {
  const { t } = useTranslation();
  const since = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <Card className="w-full gap-1 p-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground text-xs">
          {t("chat.clinicCard.title")}
        </span>
      </div>
      <span className="font-semibold text-foreground text-lg tracking-tight">
        {data.name}
      </span>
      {since ? (
        <span className="text-muted-foreground text-xs">
          {t("chat.clinicCard.since", { date: since })}
        </span>
      ) : null}
    </Card>
  );
}
