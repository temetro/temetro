"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getVersionInfo } from "@/lib/version";

const DISMISS_KEY = "temetro:update-dismissed";

// A small, dismissible notice shown when a newer temetro release exists. Updating
// is optional — dismissing remembers the version so we don't nag again until the
// next release. Errors are swallowed (offline / private deployments).
export function UpdateBanner() {
  const { t } = useTranslation();
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getVersionInfo()
      .then((info) => {
        if (!active || !info.updateAvailable || !info.latest) return;
        if (localStorage.getItem(DISMISS_KEY) === info.latest) return;
        setLatest(info.latest);
      })
      .catch(() => {
        /* offline or no update server — stay silent */
      });
    return () => {
      active = false;
    };
  }, []);

  if (!latest) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, latest);
    setLatest(null);
  };

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
      <div className="space-y-1.5">
        <p className="text-sm text-foreground">
          {t("settings.version.banner", { version: latest })}
        </p>
        <Link
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          href="/settings?tab=version"
          onClick={dismiss}
        >
          {t("settings.version.bannerUpdate")}
        </Link>
      </div>
      <button
        aria-label={t("settings.version.bannerDismiss")}
        className="-mr-1 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={dismiss}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
