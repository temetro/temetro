"use client";

import { TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { getAiConfig } from "@/lib/ai-settings";

// A thin, dismissible warning bar shown flush above the chat input whenever no
// AI provider is wired up yet — either no API key for any cloud provider, or the
// app is in local mode with no Ollama endpoint set. Without this, sending a
// message just fails silently, so the banner spells out the missing setup and
// links straight to AI settings. Rendered in both the empty and active chat
// states so a user mid-conversation with no provider still sees why replies fail.
export function AiSetupNotice() {
  const { t } = useTranslation();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    getAiConfig()
      .then((cfg) => {
        if (!active) return;
        // Configured = an API key for any provider, or a local Ollama endpoint.
        const hasApiKey = Object.values(cfg.apiKeySet).some(Boolean);
        const hasLocal =
          cfg.mode === "local" && cfg.ollamaBaseUrl.trim().length > 0;
        setNeedsSetup(!(hasApiKey || hasLocal));
      })
      .catch(() => {
        // If we can't read the config, don't nag — the chat still works.
        if (active) setNeedsSetup(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!needsSetup || dismissed) return null;

  return (
    <div
      className="flex w-full items-center gap-2.5 rounded-2xl border border-warning/32 bg-warning/8 px-3.5 py-2 text-sm dark:bg-warning/12"
      role="status"
    >
      <TriangleAlert className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 truncate text-foreground">
        <span className="font-medium">{t("chat.setupNotice.title")}</span>
        <span className="text-muted-foreground max-sm:hidden">
          {" — "}
          {t("chat.setupNotice.body")}
        </span>
      </p>
      <Button
        className="shrink-0"
        render={<Link href="/settings?tab=ai" />}
        size="sm"
        variant="outline"
      >
        {t("chat.setupNotice.action")}
      </Button>
      <button
        aria-label={t("chat.setupNotice.dismiss")}
        className="-me-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
