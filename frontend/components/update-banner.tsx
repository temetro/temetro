"use client";

import Link from "next/link";
import { ArrowUpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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

  // Pinned to the physical bottom-right in both LTR and RTL. The user wants it
  // in the bottom-right corner in Arabic too, so we use physical `right`/`bottom`
  // rather than the logical `end` (which would flip to the left under RTL).
  return (
    <div className="fixed right-4 bottom-4 z-50 w-full max-w-sm" dir="auto">
      <Alert className="bg-card shadow-lg" variant="warning">
        <ArrowUpCircle />
        <AlertTitle className="text-foreground">
          {t("settings.version.banner", { version: latest })}
        </AlertTitle>
        <AlertAction>
          <Button
            render={
              <Link href="/settings?tab=version" onClick={dismiss} />
            }
            size="sm"
            variant="outline"
          >
            {t("settings.version.bannerUpdate")}
          </Button>
          <Button
            aria-label={t("settings.version.bannerDismiss")}
            onClick={dismiss}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
