"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// A small "Added by AI" marker shown on records the chat agent drafted/imported
// (source === "ai"). These may carry placeholder fields and are meant to be
// reviewed and edited by a clinician. Renders nothing for manual records.
export function AiBadge({
  source,
  className,
}: {
  source?: "manual" | "ai" | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (source !== "ai") return null;
  return (
    <Badge className={cn("gap-1", className)} variant="secondary">
      <Sparkles className="size-3" />
      {t("common.addedByAi")}
    </Badge>
  );
}
