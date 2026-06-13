"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

// Inline "Veil" gate. Shown above the prompt input the first time a message
// would leave the clinic for an external provider — replaces the old modal so
// the chat flow is never interrupted. Veil de-identifies PHI before the send.
export function VeilConfirmation({
  provider,
  onConfirm,
  onUseLocal,
  onCancel,
}: {
  provider: string;
  onConfirm: () => void;
  onUseLocal: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3"
      role="alertdialog"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="size-4" />
        </span>
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{t("chat.veil.title")}</p>
          <p className="text-muted-foreground text-sm">
            {t("chat.veil.body", { provider })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button onClick={onCancel} size="sm" variant="ghost">
          {t("chat.veil.cancel")}
        </Button>
        <Button onClick={onUseLocal} size="sm" variant="outline">
          {t("chat.veil.useLocal")}
        </Button>
        <Button onClick={onConfirm} size="sm">
          {t("chat.veil.confirm")}
        </Button>
      </div>
    </div>
  );
}
