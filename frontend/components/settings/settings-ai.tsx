"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FieldLabel,
  SettingsFrame,
  ToggleRow,
} from "@/components/settings/settings-parts";
import {
  type AiPolicy,
  getAiPolicy,
  saveAiPolicy,
} from "@/lib/ai-policy";
import { AI_MODELS, EFFORT_LEVELS, type Effort } from "@/lib/ai-models";
import {
  type AiConfig,
  type AiMode,
  type ApiProvider,
  type VeilLevel,
  getAiConfig,
  saveAiConfig,
  testAiConnection,
} from "@/lib/ai-settings";
import { useActiveRole } from "@/lib/roles";
import { notify } from "@/lib/toast";

const PROVIDERS: ApiProvider[] = ["openai", "anthropic", "gemini"];
const VEIL_LEVELS: VeilLevel[] = ["full", "names", "off"];

const DEFAULTS: AiConfig = {
  mode: "auto",
  provider: "anthropic",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.1",
  defaultModel: "claude-sonnet-4-6",
  defaultEffort: "medium",
  veilLevel: "full",
  apiKeySet: { openai: false, anthropic: false, gemini: false },
};

export function AIPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AiConfig>(DEFAULTS);
  const [baseline, setBaseline] = useState<AiConfig>(DEFAULTS);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Clinic-wide AI availability (admin-controlled kill-switch).
  const role = useActiveRole();
  const isAdmin = role === "owner" || role === "admin";
  const [policy, setPolicy] = useState<AiPolicy | null>(null);
  const [policyBaseline, setPolicyBaseline] = useState<AiPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAiPolicy()
      .then((p) => {
        if (cancelled) return;
        setPolicy(p);
        setPolicyBaseline(p);
      })
      .catch(() => {
        /* leave null; section just won't render its controls */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const policyDirty =
    policy != null &&
    policyBaseline != null &&
    JSON.stringify(policy) !== JSON.stringify(policyBaseline);

  const savePolicy = async () => {
    if (!policy) return;
    setSavingPolicy(true);
    try {
      const saved = await saveAiPolicy(policy);
      setPolicy(saved);
      setPolicyBaseline(saved);
      notify.success(
        t("settings.ai.availability.savedTitle"),
        t("settings.ai.availability.savedBody"),
      );
    } catch {
      notify.error(
        t("settings.ai.saveFailedTitle"),
        t("settings.ai.saveFailedBody"),
      );
    } finally {
      setSavingPolicy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAiConfig()
      .then((stored) => {
        if (cancelled) return;
        setConfig(stored);
        setBaseline(stored);
      })
      .catch(() => {
        // Keep defaults; Save will retry against the backend.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  // Switching provider: if the current default model doesn't belong to the new
  // provider, pick that provider's first model so they never end up mismatched.
  const setProvider = (provider: ApiProvider) =>
    setConfig((prev) => {
      const models = AI_MODELS.filter((m) => m.provider === provider);
      const stillValid = models.some((m) => m.id === prev.defaultModel);
      return {
        ...prev,
        provider,
        defaultModel: stillValid ? prev.defaultModel : (models[0]?.id ?? prev.defaultModel),
      };
    });

  // Models available for the currently selected cloud provider.
  const providerModels = useMemo(
    () => AI_MODELS.filter((m) => m.provider === config.provider),
    [config.provider],
  );

  const dirty =
    JSON.stringify(config) !== JSON.stringify(baseline) || apiKey.length > 0;

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        mode: config.mode,
        provider: config.provider,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
        defaultModel: config.defaultModel,
        defaultEffort: config.defaultEffort,
        veilLevel: config.veilLevel,
        ...(apiKey ? { apiKey } : {}),
      };
      const saved = await saveAiConfig(patch);
      setConfig(saved);
      setBaseline(saved);
      setApiKey("");
      notify.success(t("settings.ai.savedTitle"), t("settings.ai.savedBody"));
    } catch {
      notify.error(
        t("settings.ai.saveFailedTitle"),
        t("settings.ai.saveFailedBody"),
      );
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await testAiConnection({
        mode: config.mode,
        provider: config.provider,
        ollamaBaseUrl: config.ollamaBaseUrl,
      });
      if (result.ok) notify.success(t("settings.ai.testOk"), result.message);
      else notify.error(t("settings.ai.testFailed"), result.message);
    } catch {
      notify.error(t("settings.ai.testFailed"), t("settings.ai.testError"));
    } finally {
      setTesting(false);
    }
  };

  const keyIsSet = config.apiKeySet[config.provider];

  // Which mode-hint copy to show under the Mode select.
  const modeHintSuffix =
    config.mode === "api"
      ? "Api"
      : config.mode === "local"
        ? "Local"
        : config.mode === "off"
          ? "Off"
          : "Auto";

  return (
    <>
      {policy ? (
        <SettingsFrame
          bodyClassName="space-y-3"
          description={t("settings.ai.availability.description")}
          title={t("settings.ai.availability.title")}
        >
          {isAdmin ? (
            <>
              <ToggleRow
                checked={policy.aiEnabled}
                description={t("settings.ai.availability.enabledHint")}
                onCheckedChange={(checked) =>
                  setPolicy((p) => (p ? { ...p, aiEnabled: checked } : p))
                }
                title={t("settings.ai.availability.enabled")}
              />
              {policy.aiEnabled ? (
                <ToggleRow
                  checked={policy.disabledForEmployees}
                  description={t(
                    "settings.ai.availability.employeesOnlyHint",
                  )}
                  onCheckedChange={(checked) =>
                    setPolicy((p) =>
                      p ? { ...p, disabledForEmployees: checked } : p,
                    )
                  }
                  title={t("settings.ai.availability.employeesOnly")}
                />
              ) : null}
              {policyDirty ? (
                <div className="flex justify-end">
                  <Button
                    disabled={savingPolicy}
                    onClick={savePolicy}
                    size="sm"
                  >
                    {savingPolicy
                      ? t("settings.ai.saving")
                      : t("settings.ai.saveChanges")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {policy.aiEnabled
                ? policy.disabledForEmployees
                  ? t("settings.ai.availability.readonlyEmployeesOnly")
                  : t("settings.ai.availability.readonlyEnabled")
                : t("settings.ai.availability.readonlyDisabled")}
            </p>
          )}
        </SettingsFrame>
      ) : null}

      <SettingsFrame
        description={t("settings.ai.modeDescription")}
        title={t("settings.ai.modeTitle")}
      >
        <div className="space-y-1.5">
          <FieldLabel>{t("settings.ai.mode")}</FieldLabel>
          <Select
            onValueChange={(value) => set("mode", value as AiMode)}
            value={config.mode}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="auto">
                {t("settings.ai.modeAuto")}
              </SelectItem>
              <SelectItem value="api">{t("settings.ai.modeApi")}</SelectItem>
              <SelectItem value="local">
                {t("settings.ai.modeLocal")}
              </SelectItem>
              <SelectItem value="off">{t("settings.ai.modeOff")}</SelectItem>
            </SelectPopup>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t(`settings.ai.mode${modeHintSuffix}Hint`)}
          </p>
        </div>
      </SettingsFrame>

      {config.mode === "off" ? (
        <SettingsFrame
          description={t("settings.ai.offDescription")}
          title={t("settings.ai.offTitle")}
        >
          <p className="text-sm text-muted-foreground">
            {t("settings.ai.offNote")}
          </p>
        </SettingsFrame>
      ) : config.mode !== "local" ? (
        // API and Automatic both configure a cloud provider (Automatic falls
        // back to local Ollama when no key is set).
        <SettingsFrame
          bodyClassName="space-y-5"
          description={t("settings.ai.providerDescription")}
          title={t("settings.ai.providerTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.ai.provider")}</FieldLabel>
                <Select
                  onValueChange={(value) => setProvider(value as ApiProvider)}
                  value={config.provider}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`settings.ai.providers.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.ai.defaultModel")}</FieldLabel>
                <Select
                  onValueChange={(value) => set("defaultModel", value as string)}
                  value={config.defaultModel}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("settings.ai.selectModel")} />
                  </SelectTrigger>
                  <SelectPopup>
                    {providerModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{t("settings.ai.apiKey")}</FieldLabel>
              <Input
                autoComplete="off"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  keyIsSet
                    ? t("settings.ai.apiKeySet")
                    : t("settings.ai.apiKeyPlaceholder")
                }
                type="password"
                value={apiKey}
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {keyIsSet ? (
                  <>
                    <Check className="size-3.5 text-foreground" />
                    {t("settings.ai.apiKeyStored", {
                      provider: t(`settings.ai.providers.${config.provider}`),
                    })}
                  </>
                ) : (
                  t("settings.ai.apiKeyHint")
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{t("settings.ai.defaultEffort")}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  set("defaultEffort", value as Effort)
                }
                value={config.defaultEffort}
              >
                <SelectTrigger className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {EFFORT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`chat.input.effortOptions.${level}`)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
        </SettingsFrame>
      ) : (
        <SettingsFrame
          bodyClassName="space-y-5"
          description={t("settings.ai.localDescription")}
          title={t("settings.ai.localTitle")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.ai.ollamaBaseUrl")}</FieldLabel>
                <Input
                  onChange={(event) => set("ollamaBaseUrl", event.target.value)}
                  placeholder="http://localhost:11434"
                  value={config.ollamaBaseUrl}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.ai.ollamaModel")}</FieldLabel>
                <Input
                  onChange={(event) => set("ollamaModel", event.target.value)}
                  placeholder="llama3.1"
                  value={config.ollamaModel}
                />
              </div>
            </div>
            <Button
              className="rounded-lg"
              disabled={testing}
              onClick={test}
              size="sm"
              variant="outline"
            >
              {testing
                ? t("settings.ai.testing")
                : t("settings.ai.testConnection")}
            </Button>
        </SettingsFrame>
      )}

      {config.mode !== "off" ? (
        <SettingsFrame
          bodyClassName="space-y-4"
          description={t("settings.ai.veilDescription")}
          title={t("settings.ai.veilTitle")}
        >
          <div className="space-y-1.5">
              <FieldLabel>{t("settings.ai.veilLevel")}</FieldLabel>
              <Select
                onValueChange={(value) => set("veilLevel", value as VeilLevel)}
                value={config.veilLevel}
              >
                <SelectTrigger className="sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {VEIL_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`settings.ai.veilLevels.${level}`)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.mode === "local"
                ? t("settings.ai.veilLocalNote")
                : t("settings.ai.veilApiNote")}
            </p>
        </SettingsFrame>
      ) : null}

      {dirty ? (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
            <p className="text-sm text-muted-foreground">
              {t("settings.ai.unsavedChanges")}
            </p>
            <Button disabled={saving} onClick={save} size="sm">
              {saving ? t("settings.ai.saving") : t("settings.ai.saveChanges")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
