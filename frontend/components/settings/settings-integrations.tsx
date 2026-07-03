"use client";

import { CheckCircle2, CircleDashed, Copy, KeyRound, Trash2, XCircle } from "lucide-react";
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
import { API_BASE_URL } from "@/lib/api-client";
import {
  createFhirKey,
  type FhirApiKey,
  type IntegrationConfig,
  type IntegrationType,
  listFhirKeys,
  listIntegrations,
  revokeFhirKey,
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

// The read-only FHIR R4 server. Unlike the integration cards above (which make
// temetro a FHIR *client*), this exposes temetro's own records over `/fhir` to
// external systems, authenticated with per-clinic API keys. Owner/admin only:
// the component self-gates by hiding when the keys fetch is forbidden.
function FhirServerCard() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<FhirApiKey[] | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const baseUrl = `${API_BASE_URL}/fhir`;

  useEffect(() => {
    let active = true;
    listFhirKeys()
      .then((rows) => active && setKeys(rows))
      .catch(() => {
        if (active) {
          setAllowed(false);
          setKeys([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createFhirKey(name.trim());
      setFreshSecret(created.secret);
      setKeys((prev) => [created, ...(prev ?? [])]);
      setName("");
    } catch {
      notify.error(
        t("settings.integrations.fhirServer.createFailed"),
        t("settings.integrations.fhirServer.createFailedBody"),
      );
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeFhirKey(id);
      setKeys((prev) =>
        (prev ?? []).map((k) => (k.id === id ? { ...k, revoked: true } : k)),
      );
    } catch {
      notify.error(
        t("settings.integrations.fhirServer.revokeFailed"),
        t("settings.integrations.fhirServer.revokeFailedBody"),
      );
    } finally {
      setConfirmRevoke(null);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(label, "");
    } catch {
      // Clipboard blocked — no-op; the value is visible for manual copy.
    }
  };

  if (!allowed) return null;

  return (
    <SettingsSection
      description={t("settings.integrations.fhirServer.description")}
      title={t("settings.integrations.fhirServer.title")}
    >
      <SettingsCard className="space-y-5 p-5">
        <div className="space-y-1.5">
          <FieldLabel>{t("settings.integrations.fhirServer.baseUrl")}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input readOnly value={baseUrl} />
            <Button
              onClick={() =>
                copy(baseUrl, t("settings.integrations.fhirServer.copiedUrl"))
              }
              size="icon"
              variant="outline"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.integrations.fhirServer.baseUrlHint")}
          </p>
        </div>

        {freshSecret ? (
          <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              {t("settings.integrations.fhirServer.secretTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.integrations.fhirServer.secretHint")}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                {freshSecret}
              </code>
              <Button
                onClick={() =>
                  copy(
                    freshSecret,
                    t("settings.integrations.fhirServer.copiedSecret"),
                  )
                }
                size="icon"
                variant="outline"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <Button onClick={() => setFreshSecret(null)} size="sm" variant="ghost">
              {t("settings.integrations.fhirServer.dismissSecret")}
            </Button>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <FieldLabel>{t("settings.integrations.fhirServer.newKey")}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("settings.integrations.fhirServer.newKeyPlaceholder")}
              value={name}
            />
            <Button disabled={creating || !name.trim()} onClick={create} size="sm">
              <KeyRound className="size-4" />
              {creating
                ? t("settings.integrations.fhirServer.creating")
                : t("settings.integrations.fhirServer.create")}
            </Button>
          </div>
        </div>

        {keys && keys.length > 0 ? (
          <ul className="divide-y rounded-2xl border">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.lastUsedAt
                      ? t("settings.integrations.fhirServer.lastUsed", {
                          when: new Date(k.lastUsedAt).toLocaleString(),
                        })
                      : t("settings.integrations.fhirServer.neverUsed")}
                  </p>
                </div>
                {k.revoked ? (
                  <Badge variant="outline">
                    {t("settings.integrations.fhirServer.revoked")}
                  </Badge>
                ) : confirmRevoke === k.id ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => revoke(k.id)}
                      size="sm"
                      variant="destructive"
                    >
                      {t("settings.integrations.fhirServer.confirmRevoke")}
                    </Button>
                    <Button
                      onClick={() => setConfirmRevoke(null)}
                      size="sm"
                      variant="ghost"
                    >
                      {t("settings.integrations.fhirServer.cancel")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setConfirmRevoke(k.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="size-4" />
                    {t("settings.integrations.fhirServer.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("settings.integrations.fhirServer.noKeys")}
          </p>
        )}
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
      <FhirServerCard />
    </div>
  );
}
