"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CopyField,
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";
import {
  getSigningKey,
  listSignedRecords,
  rotateSigningKey,
  type SharedRecord,
  type SigningKey,
} from "@/lib/signing";
import { notify } from "@/lib/toast";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SigningPanel() {
  const { t } = useTranslation();
  const [key, setKey] = useState<SigningKey | null>(null);
  const [records, setRecords] = useState<SharedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getSigningKey(), listSignedRecords().catch(() => [])])
      .then(([k, r]) => {
        if (!active) return;
        setKey(k);
        setRecords(r);
        setError(null);
      })
      .catch(() => {
        if (active) setError(t("settings.signing.loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const rotate = async () => {
    setRotating(true);
    try {
      const next = await rotateSigningKey();
      setKey(next);
      notify.success(
        t("settings.signing.rotateSuccessTitle"),
        t("settings.signing.rotateSuccessBody"),
      );
    } catch {
      notify.error(
        t("settings.signing.rotateErrorTitle"),
        t("settings.signing.rotateError"),
      );
    } finally {
      setRotating(false);
    }
  };

  const recordStatusLabel = (status: SharedRecord["status"]): string =>
    t(
      `settings.signing.records.status${
        status.charAt(0).toUpperCase() + status.slice(1)
      }`,
    );

  return (
    <>
      <SettingsCard className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight">
              {t("settings.signing.keyTitle")}
            </h3>
            <Badge className="bg-emerald-500/15 text-emerald-400">
              {t("settings.signing.active")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.signing.keyDescription")}
          </p>
          <Button
            className={cn("rounded-lg", whiteButton)}
            disabled={rotating || loading}
            onClick={rotate}
            type="button"
          >
            {rotating
              ? t("settings.signing.rotating")
              : t("settings.signing.rotateKey")}
          </Button>
        </div>
        <div className="sm:text-end">
          <p className="text-3xl font-semibold tracking-tight">Ed25519</p>
          <p className="text-sm text-muted-foreground">
            {key
              ? t("settings.signing.createdAtLabel", {
                  date: formatDate(key.createdAt),
                })
              : loading
                ? t("settings.signing.loading")
                : error ?? ""}
          </p>
          {key?.rotatedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.signing.rotatedAtLabel", {
                date: formatDate(key.rotatedAt),
              })}
            </p>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsSection
        description={t("settings.signing.identityDescription")}
        title={t("settings.signing.identityTitle")}
      >
        <SettingsCard className="p-5">
          <CopyField
            description={t("settings.signing.fingerprintDescription")}
            label={t("settings.signing.fingerprintLabel")}
            value={key?.fingerprint ?? "—"}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.howItWorksDescription")}
        title={t("settings.signing.howItWorksTitle")}
      >
        <SettingsCard className="divide-y divide-border">
          {(["sign", "approve", "verify"] as const).map((step, index) => (
            <div className="flex items-start gap-3 px-4 py-3.5" key={step}>
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t(`settings.signing.steps.${step}`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`settings.signing.steps.${step}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.backupDescription")}
        title={t("settings.signing.backupTitle")}
      >
        <SettingsCard className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings.signing.backupLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.signing.backupDesc")}
            </p>
          </div>
          <Badge variant="secondary">{t("settings.signing.comingSoon")}</Badge>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.signing.signedRecordsDescription")}
        title={t("settings.signing.signedRecordsTitle")}
      >
        {records.length === 0 ? (
          <SettingsCard className="flex items-center justify-center p-12">
            <p className="text-sm text-muted-foreground">
              {t("settings.signing.noPending")}
            </p>
          </SettingsCard>
        ) : (
          <SettingsCard className="divide-y divide-border">
            {records.map((record) => (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3.5"
                key={record.id}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-mono text-sm">
                    {record.walletNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.shareMode === "temporary"
                      ? t("settings.signing.records.temporary")
                      : t("settings.signing.records.permanent")}
                    {record.shareExpiresAt
                      ? ` · ${t("settings.signing.records.expires", {
                          date: formatDate(record.shareExpiresAt),
                        })}`
                      : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  {recordStatusLabel(record.status)}
                </Badge>
              </div>
            ))}
          </SettingsCard>
        )}
      </SettingsSection>
    </>
  );
}
