"use client";

import { Pill, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import {
  type Availability,
  type InventoryItem,
  availabilityOf,
} from "@/lib/inventory";

const availabilityVariant: Record<
  Availability,
  "success" | "warning" | "destructive"
> = {
  "in-stock": "success",
  low: "warning",
  out: "destructive",
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-foreground text-sm">{value}</span>
    </div>
  );
}

// Read-only detail for a single inventory item, opened by clicking a row on the
// inventory list. Editing stock is a later step; this surfaces all the fields a
// quick row can't show (reorder threshold, location, expiry, notes).
export function InventoryDetailDialog({
  item,
  open,
  onOpenChange,
  onDelete,
}: {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  if (!item) return null;
  const availability = availabilityOf(item);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
              <Pill className="size-4" />
            </span>
            <span className="min-w-0 truncate">{item.name}</span>
            <Badge
              className="ml-auto shrink-0"
              variant={availabilityVariant[availability]}
            >
              {t(`inventory.availability.${availability}`)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {[item.strength, item.form].filter(Boolean).join(" · ") ||
              t("inventory.detail.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="divide-y divide-border">
            <Row
              label={t("inventory.dialog.stock")}
              value={t("inventory.stock", {
                count: item.stockQuantity,
                unit: item.unit || "units",
              })}
            />
            <Row
              label={t("inventory.dialog.reorder")}
              value={item.reorderThreshold || "—"}
            />
            <Row
              label={t("inventory.dialog.form")}
              value={item.form || "—"}
            />
            <Row
              label={t("inventory.dialog.strength")}
              value={item.strength || "—"}
            />
            <Row
              label={t("inventory.dialog.location")}
              value={item.location || "—"}
            />
            <Row
              label={t("inventory.dialog.expires")}
              value={item.expiresAt || "—"}
            />
            {item.notes ? (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-muted-foreground text-sm">
                  {t("inventory.detail.notes")}
                </span>
                <span className="whitespace-pre-wrap text-foreground text-sm">
                  {item.notes}
                </span>
              </div>
            ) : null}
          </div>
        </DialogPanel>

        <DialogFooter variant={onDelete ? "bare" : undefined}>
          {onDelete && (
            <Button
              className="me-auto"
              onClick={onDelete}
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              {t("inventory.detail.delete")}
            </Button>
          )}
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("inventory.detail.close")}
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
