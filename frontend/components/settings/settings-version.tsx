"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CopyField,
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { Button } from "@/components/ui/button";
import { getNetworkInfo, getVersionInfo, type VersionInfo } from "@/lib/version";
import { cn } from "@/lib/utils";

// Self-hosted update path: pull the new images and restart on the server.
const UPDATE_COMMAND = "docker compose pull && docker compose up -d";

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "update" | "muted";
  children: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "update"
          ? "bg-primary/15 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

export function VersionPanel() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [networkUrls, setNetworkUrls] = useState<string[]>([]);

  useEffect(() => {
    getVersionInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  // "Check for updates" — force a fresh, cache-bypassing lookup on the backend.
  const checkForUpdates = () => {
    setChecking(true);
    getVersionInfo(true)
      .then(setInfo)
      .catch(() => {
        /* keep the last known info on a failed manual check */
      })
      .finally(() => setChecking(false));
  };

  // The most reliable shareable URL is the one the browser is already using —
  // unless that's localhost, in which case we fall back to the backend's
  // detected LAN addresses (accurate when not running in Docker's bridge net).
  const localShareUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (isLocalHost(window.location.hostname)) return null;
    return `${window.location.protocol}//${window.location.host}`;
  }, []);

  useEffect(() => {
    if (localShareUrl) return;
    getNetworkInfo()
      // Guard against an unexpected shape so a missing/garbled response shows the
      // helpful "open via the server's IP" hint rather than a broken value.
      .then((n) => setNetworkUrls(Array.isArray(n?.urls) ? n.urls : []))
      .catch(() => setNetworkUrls([]));
  }, [localShareUrl]);

  const statusBadge = loading || checking ? (
    <Badge tone="muted">{t("settings.version.checking")}</Badge>
  ) : !info || info.latest === null ? (
    <Badge tone="muted">{t("settings.version.offline")}</Badge>
  ) : info.updateAvailable ? (
    <Badge tone="update">{t("settings.version.updateAvailable")}</Badge>
  ) : (
    <Badge tone="ok">{t("settings.version.upToDate")}</Badge>
  );

  return (
    <div className="space-y-12">
      <SettingsSection
        title={t("settings.version.title")}
        description={t("settings.version.description")}
      >
        <SettingsCard className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings.version.current")}
              </p>
              <p className="text-sm text-muted-foreground">
                {info?.current ?? "—"}
              </p>
            </div>
            {statusBadge}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings.version.latest")}
              </p>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? t("settings.version.checking")
                  : (info?.latest ?? t("settings.version.offline"))}
              </p>
            </div>
            {info?.releaseUrl ? (
              <a
                className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href={info.releaseUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("settings.version.viewRelease")}
              </a>
            ) : null}
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button
              disabled={loading || checking}
              onClick={checkForUpdates}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className={cn("size-4", checking && "animate-spin")} />
              {checking
                ? t("settings.version.checking")
                : t("settings.version.checkNow")}
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t("settings.version.updateTitle")}
        description={t("settings.version.updateDescription")}
      >
        <SettingsCard className="p-5">
          <CopyField
            label={t("settings.version.updateCommandLabel")}
            value={UPDATE_COMMAND}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title={t("settings.version.networkTitle")}
        description={t("settings.version.networkDescription")}
      >
        <SettingsCard className="space-y-4 p-5">
          {localShareUrl ? (
            <CopyField
              label={t("settings.version.networkUrlLabel")}
              value={localShareUrl}
            />
          ) : networkUrls.length > 0 ? (
            networkUrls.map((url) => (
              <CopyField
                key={url}
                label={t("settings.version.networkUrlLabel")}
                value={url}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("settings.version.networkLocalHint")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("settings.version.networkFirewallHint")}
          </p>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
