"use client";

import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { type ChatMode, CHAT_MODES, getMode } from "@/lib/chat-modes";

type ModePickerProps = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  triggerClassName: string;
};

/**
 * The situation-mode control in the chat composer (Chat / Analysis / Graph).
 * Replaces the old model picker — clinicians pick what they want the assistant
 * to do, not which LLM runs (that's configured once in Settings → AI).
 */
export function ModePicker({
  mode,
  onModeChange,
  triggerClassName,
}: ModePickerProps) {
  const { t } = useTranslation();
  const selected = getMode(mode);
  const SelectedIcon = selected.icon;

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            aria-label={t("chat.input.mode")}
            className={triggerClassName}
            type="button"
          />
        }
      >
        <SelectedIcon className="size-4 opacity-80" />
        <span className="truncate font-medium text-foreground">
          {t(selected.labelKey)}
        </span>
        <ChevronDown className="size-4 opacity-70" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-64">
        <MenuRadioGroup
          onValueChange={(value) => onModeChange(value as ChatMode)}
          value={mode}
        >
          {CHAT_MODES.map((m) => {
            const Icon = m.icon;
            return (
              <MenuRadioItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  <Icon className="size-4 opacity-80" />
                  <span className="flex flex-col">
                    <span className="text-foreground">{t(m.labelKey)}</span>
                    <span className="text-muted-foreground text-xs">
                      {t(m.descriptionKey)}
                    </span>
                  </span>
                </span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
