"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

// Camera barcode/QR scanner in a dialog. Decoding uses @zxing/browser
// (lazy-loaded so it stays out of the initial bundle), which reads 1D barcodes
// (EAN/UPC/Code128) and 2D codes (QR, GS1 DataMatrix, PDF417) — the mix found
// on medication packaging and patient wallet codes. Emits the decoded string
// once, then the caller closes the dialog.
export function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Keep the latest onDetected without restarting the camera on every render.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let controls: { stop: () => void } | null = null;
    setError(null);

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result) => {
            if (result && !stopped) {
              stopped = true;
              controls?.stop();
              onDetectedRef.current(result.getText());
            }
          },
        );
        // The dialog may have closed while getUserMedia was resolving.
        if (stopped) controls.stop();
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? t("scan.permissionDenied")
            : t("scan.unavailable"),
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open, t]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("scan.title")}</DialogTitle>
          <DialogDescription>
            {description ?? t("scan.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-2xl border bg-black">
              {/* biome-ignore lint/a11y/useMediaCaption: live camera preview */}
              <video
                className="size-full object-cover"
                muted
                playsInline
                ref={videoRef}
              />
              <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("scan.cancel")}
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
