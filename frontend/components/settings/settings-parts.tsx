"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
} from "@/components/ui/card";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Whether the enclosing frame is a COSS "Separated Panels" tray. When true,
// SettingsCard/ToggleRow render as a FramePanel (a distinct bordered card on the
// muted tray) instead of a fused CardFrame Card.
const SeparatedFrameContext = createContext(false);

// A settings section rendered inside the COSS "frame" surface: a titled header
// above one or more cards.
//
// Children are rendered as *direct* children of CardFrame on purpose. CardFrame
// styles its cards through direct-child selectors (`*:data-[slot=card]:-m-px`,
// the clip-path, `rounded-t/b-xl`, `shadow-none`, `before:hidden`) — it pulls
// each card out by a pixel so it sits flush inside the frame's own border. Put
// anything between the frame and the card, even an unstyled div, and every one
// of those selectors stops matching: the card keeps its own border and shadow
// and you get a box inside a box.
//
// So: no padding here. Body padding belongs on the Card (`<SettingsCard
// className="p-5">`), which is where COSS puts it.
export function SettingsFrame({
  title,
  description,
  action,
  children,
  className,
  separated = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * COSS "Separated Panels": render a muted Frame tray whose children are
   * distinct bordered FramePanels spaced apart (the real coss.com/ui/frame
   * look), instead of the fused CardFrame surface. Leave off for a joined list.
   */
  separated?: boolean;
}) {
  if (separated) {
    return (
      <Frame className={className}>
        <div
          className="flex items-start justify-between gap-4 px-4 py-3"
          data-slot="frame-header"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-semibold">{title}</p>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <SeparatedFrameContext.Provider value={true}>
          {children}
        </SeparatedFrameContext.Provider>
      </Frame>
    );
  }

  return (
    <CardFrame className={className}>
      <CardFrameHeader className="border-b border-border/60">
        <CardFrameTitle className="text-base">{title}</CardFrameTitle>
        {description ? (
          <CardFrameDescription>{description}</CardFrameDescription>
        ) : null}
        {action ? <CardFrameAction>{action}</CardFrameAction> : null}
      </CardFrameHeader>
      {children}
    </CardFrame>
  );
}

// Back-compat wrapper: existing panels compose with SettingsSection, which
// renders through the COSS frame surface so the whole settings page shares one
// framed look.
export function SettingsSection({
  title,
  description,
  action,
  children,
  separated = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  /** See {@link SettingsFrame}'s `separated` — spaces sibling panels apart. */
  separated?: boolean;
}) {
  return (
    <SettingsFrame
      action={action}
      description={description}
      separated={separated}
      title={title}
    >
      {children}
    </SettingsFrame>
  );
}

// A card surface used inside settings panels. Rendering a real COSS `Card` (with
// `data-slot="card"`) keeps settings cards consistent with the rest of the app
// and lets them pick up the frame's card treatment. `Card` is `flex flex-col`,
// so row layouts must pass `flex-row` in their className. It carries no padding
// of its own — pass `p-5` (the settings default) or a `divide-y` list.
export function SettingsCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const separated = useContext(SeparatedFrameContext);
  if (separated) {
    // A distinct panel on the Frame tray. `flex flex-col` mirrors Card's default
    // layout; callers that need a row (ToggleRow) override with `flex-row`.
    return (
      <FramePanel className={cn("flex flex-col", className)}>
        {children}
      </FramePanel>
    );
  }
  return <Card className={className}>{children}</Card>;
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
    <SettingsCard className="flex flex-row items-center justify-between gap-4 px-4 py-3.5">
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
      <div className="flex h-9 w-full items-center gap-2 rounded-3xl bg-input/50 pe-1 ps-3 sm:w-80">
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
