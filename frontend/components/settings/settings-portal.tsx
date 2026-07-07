"use client";

import { ExternalLink, QrCode } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import QRCodeSvg from "react-qr-code";

import {
  CopyField,
  SettingsCard,
  SettingsSection,
  whiteButton,
} from "@/components/settings/settings-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { resolveBackendUrl } from "@/lib/backend-url";
import { cn } from "@/lib/utils";

// Patient Portal section (Settings → Signing): surfaces the clinic's public
// portal link so patients can open it, copy it, or scan a QR. The portal lives
// at /portal/<org-slug>; the QR also carries the backend base (`?api=`) so the
// patient wallet app can reach the JSON API when it scans the same code.
export function PatientPortalSection() {
  const { t } = useTranslation();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [qrOpen, setQrOpen] = useState(false);

  const slug = activeOrg?.slug;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = slug ? `${origin}/portal/${slug}` : "";
  const qrUrl = slug
    ? `${portalUrl}?api=${encodeURIComponent(resolveBackendUrl())}`
    : "";

  return (
    <SettingsSection
      description={t("settings.portal.description")}
      title={t("settings.portal.title")}
    >
      <SettingsCard className="flex flex-col gap-4 p-5">
        <CopyField
          description={t("settings.portal.linkDescription")}
          label={t("settings.portal.linkLabel")}
          value={portalUrl || "—"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            className={cn("rounded-lg", whiteButton)}
            disabled={!portalUrl}
            onClick={() => window.open(portalUrl, "_blank", "noopener")}
            type="button"
          >
            <ExternalLink className="size-4" />
            {t("settings.portal.open")}
          </Button>
          <Button
            className="rounded-lg"
            disabled={!qrUrl}
            onClick={() => setQrOpen(true)}
            type="button"
            variant="outline"
          >
            <QrCode className="size-4" />
            {t("settings.portal.showQr")}
          </Button>
        </div>
      </SettingsCard>

      <Dialog onOpenChange={setQrOpen} open={qrOpen}>
        <DialogPopup className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.portal.qrTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.portal.qrDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col items-center gap-3 pb-2">
            {qrUrl ? (
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSvg value={qrUrl} size={220} />
              </div>
            ) : null}
            <p className="break-all text-center text-sm text-muted-foreground">
              {portalUrl}
            </p>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </SettingsSection>
  );
}
