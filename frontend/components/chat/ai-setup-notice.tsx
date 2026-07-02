"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { getAiConfig } from "@/lib/ai-settings";

// A single, dismissible heads-up shown above the chat input on a fresh chat when
// no AI provider is configured yet (no API key, and no local Ollama). It only
// renders on the empty state, so it naturally disappears once a message is sent.
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
      className="flex w-full items-start gap-3 rounded-2xl border border-info/30 bg-info/8 px-4 py-3 text-sm dark:bg-info/12"
      role="status"
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-info-foreground" />
      <div className="flex-1 space-y-0.5">
        <p className="font-medium text-foreground">
          {t("chat.setupNotice.title")}
        </p>
        <p className="text-muted-foreground">{t("chat.setupNotice.body")}</p>
        <Button
          className="mt-1 px-0 text-info-foreground"
          render={<Link href="/settings?tab=ai" />}
          size="sm"
          variant="link"
        >
          {t("chat.setupNotice.action")}
        </Button>
      </div>
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
