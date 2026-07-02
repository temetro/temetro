"use client";

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  FieldLabel,
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  type IntegrationConfig,
  type IntegrationType,
  listIntegrations,
  saveIntegration,
  testIntegration,
} from "@/lib/integrations";
import { notify } from "@/lib/toast";

const TYPES: IntegrationType[] = ["fhir", "eprescribe", "claims"];

function StatusBadge({ config }: { config: IntegrationConfig }) {
  const { t } = useTranslation();
  if (config.status === "connected") {
    return (
      <Badge className="gap-1" variant="secondary">
        <CheckCircle2 className="size-3" />
        {t("settings.integrations.status.connected")}
      </Badge>
    );
  }
  if (config.status === "error") {
    return (
      <Badge className="gap-1" variant="destructive">
        <XCircle className="size-3" />
        {t("settings.integrations.status.error")}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1" variant="outline">
      <CircleDashed className="size-3" />
      {t("settings.integrations.status.unconfigured")}
    </Badge>
  );
}

function IntegrationCard({
  type,
  initial,
}: {
  type: IntegrationType;
  initial: IntegrationConfig;
}) {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [enabled, setEnabled] = useState(initial.enabled);
  // Empty = leave the stored secret untouched; typing replaces it.
  const [credentials, setCredentials] = useState("");
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const dirty =
    endpoint !== config.endpoint ||
    enabled !== config.enabled ||
    credentials.length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveIntegration(type, {
        endpoint,
        enabled,
        ...(credentials ? { credentials } : {}),
      });
      setConfig(saved);
      setEndpoint(saved.endpoint);
      setEnabled(saved.enabled);
      setCredentials("");
      notify.success(
        t("settings.integrations.savedTitle"),
        t(`settings.integrations.${type}.title`),
      );
    } catch {
      notify.error(
        t("settings.integrations.saveFailedTitle"),
        t("settings.integrations.saveFailedBody"),
      );
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await testIntegration(type);
      if (result.ok) {
        notify.success(t("settings.integrations.testOk"), result.message);
      } else {
        notify.error(t("settings.integrations.testFailed"), result.message);
      }
    } catch {
      notify.error(
        t("settings.integrations.testFailed"),
        t("settings.integrations.testError"),
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <SettingsSection
      action={<StatusBadge config={config} />}
      description={t(`settings.integrations.${type}.description`)}
      title={t(`settings.integrations.${type}.title`)}
    >
      <SettingsCard className="space-y-5 p-5">
        <div className="space-y-1.5">
          <FieldLabel>{t("settings.integrations.endpoint")}</FieldLabel>
          <Input
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder={t(`settings.integrations.${type}.endpointPlaceholder`)}
            value={endpoint}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>{t("settings.integrations.credentials")}</FieldLabel>
          <Input
            autoComplete="off"
            onChange={(e) => setCredentials(e.target.value)}
            placeholder={
              config.hasCredentials
                ? t("settings.integrations.credentialsSet")
                : t(`settings.integrations.${type}.credentialsPlaceholder`)
            }
            type="password"
            value={credentials}
          />
          <p className="text-xs text-muted-foreground">
            {t(`settings.integrations.${type}.credentialsHint`)}
          </p>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border bg-card/30 px-4 py-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              {t("settings.integrations.enable")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("settings.integrations.enableHint")}
            </span>
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>

        <div className="flex items-center gap-2">
          <Button disabled={saving || !dirty} onClick={save} size="sm">
            {saving
              ? t("settings.integrations.saving")
              : t("settings.integrations.save")}
          </Button>
          <Button
            disabled={testing}
            onClick={test}
            size="sm"
            variant="outline"
          >
            {testing
              ? t("settings.integrations.testing")
              : t("settings.integrations.test")}
          </Button>
          {config.lastSyncAt ? (
            <span className="ms-auto text-xs text-muted-foreground">
              {t("settings.integrations.lastSync", {
                when: new Date(config.lastSyncAt).toLocaleString(),
              })}
            </span>
          ) : null}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

export function IntegrationsPanel() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<IntegrationConfig[] | null>(null);

  useEffect(() => {
    let active = true;
    listIntegrations()
      .then((rows) => active && setConfigs(rows))
      .catch(() => active && setConfigs([]));
    return () => {
      active = false;
    };
  }, []);

  if (configs === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("settings.integrations.loading")}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t("settings.integrations.intro")}
      </p>
      {TYPES.map((type) => {
        const initial =
          configs.find((c) => c.type === type) ??
          ({
            type,
            endpoint: "",
            enabled: false,
            status: "unconfigured",
            hasCredentials: false,
            lastSyncAt: null,
          } satisfies IntegrationConfig);
        return <IntegrationCard initial={initial} key={type} type={type} />;
      })}
    </div>
  );
}
