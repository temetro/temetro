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
// Which advisory (if any) to show: the setup nudge (no provider wired), or a
// notice that the assistant has been switched off.
type Notice = "setup" | "off" | null;

export function AiSetupNotice() {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<Notice>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    getAiConfig()
      .then((cfg) => {
        if (!active) return;
        if (cfg.mode === "off") {
          setNotice("off");
          return;
        }
        const hasApiKey = Object.values(cfg.apiKeySet).some(Boolean);
        // Whether the assistant is actually wired up for the chosen mode:
        //  - api / auto  → needs a cloud API key (auto silently falls back to
        //                  local, but with no key we nudge the user to finish
        //                  setup rather than depend on an unverified Ollama).
        //  - local       → needs a non-empty Ollama endpoint (opted in).
        const configured =
          cfg.mode === "local"
            ? cfg.ollamaBaseUrl.trim().length > 0
            : hasApiKey;
        setNotice(configured ? null : "setup");
      })
      .catch(() => {
        // If we can't read the config, don't nag — the chat still works.
        if (active) setNotice(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!notice || dismissed) return null;

  const isOff = notice === "off";

  return (
    <div
      className="flex w-full items-center gap-2.5 rounded-2xl border border-warning/32 bg-warning/8 px-3.5 py-2 text-sm dark:bg-warning/12"
      role="status"
    >
      <TriangleAlert className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 truncate text-foreground">
        <span className="font-medium">
          {isOff
            ? t("chat.setupNotice.offTitle")
            : t("chat.setupNotice.title")}
        </span>
        <span className="text-muted-foreground max-sm:hidden">
          {" — "}
          {isOff ? t("chat.setupNotice.offBody") : t("chat.setupNotice.body")}
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
