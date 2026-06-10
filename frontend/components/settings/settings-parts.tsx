"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/30", className)}>
      {children}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  defaultChecked = false,
  checked,
  onCheckedChange,
}: {
  title: string;
  description?: string;
  defaultChecked?: boolean;
  /** Pass `checked` + `onCheckedChange` to make the switch controlled. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <SettingsCard className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        onCheckedChange={onCheckedChange}
      />
    </SettingsCard>
  );
}

export function CopyField({
  label,
  description,
  value,
}: {
  label: string;
  description?: string;
  value: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context) — silently ignore.
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex h-9 w-full items-center gap-2 rounded-3xl bg-input/50 pr-1 pl-3 sm:w-80">
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {value}
        </span>
        <button
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          onClick={copy}
          type="button"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? t("settings.copied") : t("settings.copy")}
        </button>
      </div>
    </div>
  );
}

/** Light/white CTA used for primary actions on the dark settings surface. */
export const whiteButton =
  "bg-foreground text-background hover:bg-foreground/90";

/** Field label with an optional required asterisk. */
export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="text-sm font-medium">
      {children}
      {required ? <span className="text-muted-foreground"> *</span> : null}
    </span>
  );
}
