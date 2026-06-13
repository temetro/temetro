"use client";

import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  type AiModel,
  type Effort,
  EFFORT_LEVELS,
  getModel,
  MORE_MODELS,
  PRIMARY_MODELS,
} from "@/lib/ai-models";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
  model: string;
  effort: Effort;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: Effort) => void;
  triggerClassName: string;
};

function ModelRow({ model }: { model: AiModel }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <span className="text-foreground">{model.label}</span>
      <span className="text-xs text-muted-foreground">
        {t(model.descriptionKey)}
      </span>
    </div>
  );
}

/**
 * The single model + effort control in the chat input, styled like the
 * reference design: a list of primary models, an Effort submenu, and a
 * "More models" submenu. Selection is owned by the chat panel so it travels
 * with each send.
 */
export function ModelPicker({
  model,
  effort,
  onModelChange,
  onEffortChange,
  triggerClassName,
}: ModelPickerProps) {
  const { t } = useTranslation();
  const selected = getModel(model);
  const showEffort = selected?.supportsEffort ?? false;

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            aria-label={t("chat.input.model")}
            className={triggerClassName}
            type="button"
          />
        }
      >
        <span className="truncate font-medium text-foreground">
          {selected?.label ?? t("chat.input.model")}
        </span>
        {showEffort ? (
          <span className="text-muted-foreground">
            {t(`chat.input.effortOptions.${effort}`)}
          </span>
        ) : null}
        <ChevronDown className="size-4 opacity-70" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-64">
        <MenuRadioGroup onValueChange={onModelChange} value={model}>
          {PRIMARY_MODELS.map((m) => (
            <MenuRadioItem key={m.id} value={m.id}>
              <ModelRow model={m} />
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>

        <MenuSeparator />

        {showEffort ? (
          <MenuSub>
            <MenuSubTrigger>
              <span>{t("chat.input.effort")}</span>
              <span className="ms-auto text-muted-foreground">
                {t(`chat.input.effortOptions.${effort}`)}
              </span>
            </MenuSubTrigger>
            <MenuSubPopup>
              <MenuRadioGroup
                onValueChange={(value) => onEffortChange(value as Effort)}
                value={effort}
              >
                {EFFORT_LEVELS.map((level) => (
                  <MenuRadioItem key={level} value={level}>
                    {t(`chat.input.effortOptions.${level}`)}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuSubPopup>
          </MenuSub>
        ) : null}

        <MenuSub>
          <MenuSubTrigger>{t("chat.input.moreModels")}</MenuSubTrigger>
          <MenuSubPopup className={cn("min-w-60")}>
            <MenuRadioGroup onValueChange={onModelChange} value={model}>
              {MORE_MODELS.map((m) => (
                <MenuRadioItem key={m.id} value={m.id}>
                  <ModelRow model={m} />
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubPopup>
        </MenuSub>
      </MenuPopup>
    </Menu>
  );
}
