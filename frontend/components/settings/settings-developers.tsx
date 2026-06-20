"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CopyField,
  FieldLabel,
  SettingsCard,
  SettingsSection,
} from "@/components/settings/settings-parts";
import { API_BASE_URL } from "@/lib/api-client";
import {
  type EmailConfig,
  type EmailProvider,
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
} from "@/lib/email-settings";
import { notify } from "@/lib/toast";

const PROVIDERS: EmailProvider[] = [
  "none",
  "resend",
  "postmark",
  "sendgrid",
  "smtp",
];
// Providers that authenticate with an API key (so we show the key field).
const API_KEY_PROVIDERS: EmailProvider[] = ["resend", "postmark", "sendgrid"];

const controlClass =
  "h-9 w-full rounded-3xl border border-transparent bg-input/50 px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function EmailProviderCard() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [provider, setProvider] = useState<EmailProvider>("none");
  const [fromAddress, setFromAddress] = useState("");
  const [credentials, setCredentials] = useState(""); // empty = untouched
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getEmailConfig()
      .then((c) => {
        setConfig(c);
        setProvider(c.provider);
        setFromAddress(c.fromAddress);
      })
      .catch(() => {
        /* non-admins won't reach this tab */
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveEmailConfig({
        provider,
        fromAddress: fromAddress.trim(),
        ...(credentials ? { credentials } : {}),
      });
      setConfig(saved);
      setCredentials("");
      notify.success(t("settings.developers.email.savedTitle"));
    } catch {
      notify.error(t("settings.developers.email.savedFailed"));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await testEmailConfig();
      notify.success(
        t("settings.developers.email.testSentTitle"),
        t("settings.developers.email.testSentBody", { to: r.to }),
      );
    } catch {
      notify.error(t("settings.developers.email.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  const needsKey = API_KEY_PROVIDERS.includes(provider);

  return (
    <SettingsSection
      action={
        config ? (
          <Badge variant={config.provider === "none" ? "outline" : "secondary"}>
            {t(`settings.developers.email.providers.${config.provider}`)}
          </Badge>
        ) : null
      }
      description={t("settings.developers.email.description")}
      title={t("settings.developers.email.title")}
    >
      <SettingsCard className="space-y-5 p-5">
        <div className="space-y-1.5">
          <FieldLabel>{t("settings.developers.email.provider")}</FieldLabel>
          <select
            className={controlClass}
            onChange={(e) => setProvider(e.target.value as EmailProvider)}
            value={provider}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {t(`settings.developers.email.providers.${p}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <FieldLabel>{t("settings.developers.email.from")}</FieldLabel>
          <Input
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="temetro <no-reply@yourclinic.com>"
            value={fromAddress}
          />
        </div>

        {needsKey ? (
          <div className="space-y-1.5">
            <FieldLabel>{t("settings.developers.email.apiKey")}</FieldLabel>
            <Input
              autoComplete="off"
              onChange={(e) => setCredentials(e.target.value)}
              placeholder={
                config?.hasCredentials
                  ? t("settings.developers.email.apiKeySet")
                  : t("settings.developers.email.apiKeyPlaceholder")
              }
              type="password"
              value={credentials}
            />
          </div>
        ) : provider === "smtp" ? (
          <p className="text-muted-foreground text-xs">
            {t("settings.developers.email.smtpHint")}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button disabled={saving} onClick={save} size="sm">
            {saving
              ? t("settings.developers.email.saving")
              : t("settings.developers.email.save")}
          </Button>
          <Button
            disabled={testing || provider === "none"}
            onClick={test}
            size="sm"
            variant="outline"
          >
            {testing
              ? t("settings.developers.email.testing")
              : t("settings.developers.email.test")}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

export function DevelopersPanel() {
  const { t } = useTranslation();
  return (
    <>
      <EmailProviderCard />

      <SettingsSection
        description={t("settings.developers.apiDescription")}
        title={t("settings.developers.apiTitle")}
      >
        <SettingsCard className="space-y-6 p-5">
          <CopyField
            description={t("settings.developers.baseUrlDescription")}
            label={t("settings.developers.baseUrlLabel")}
            value={API_BASE_URL}
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t("settings.developers.authLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.developers.authDescription")}
            </p>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        action={
          <Badge variant="secondary">
            {t("settings.developers.comingSoon")}
          </Badge>
        }
        description={t("settings.developers.tokensDescription")}
        title={t("settings.developers.tokensTitle")}
      >
        <SettingsCard className="flex flex-col items-center justify-center gap-3 p-10">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <KeyRound className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settings.developers.noTokens")}
          </p>
          <Button disabled size="sm" variant="outline">
            {t("settings.developers.generateToken")}
          </Button>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        description={t("settings.developers.resourcesDescription")}
        title={t("settings.developers.resourcesTitle")}
      >
        <SettingsCard className="p-5">
          <p className="text-sm text-muted-foreground">
            {t("settings.developers.resourcesBody")}
          </p>
        </SettingsCard>
      </SettingsSection>
    </>
  );
}
