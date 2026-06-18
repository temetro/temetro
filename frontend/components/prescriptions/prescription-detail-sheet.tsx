"use client";

import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SendToPharmacyButton } from "@/components/integrations/integration-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Prescription, RxStatus } from "@/components/prescriptions/prescriptions-view";
import { formatPrescribedAt } from "@/lib/prescriptions";

const statusVariant: Record<
  RxStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  completed: "outline",
  expired: "destructive",
};

// Right-side Sheet showing one prescription's full detail, opened by clicking a
// row in the Prescriptions list (mirrors the Patients table → side Sheet
// pattern). The selected record is passed in from the page.
export function PrescriptionDetailSheet({
  rx,
  open,
  onOpenChange,
  onDelete,
}: {
  rx: Prescription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional: only the Prescriptions page (full clinician) passes this, so the
  // shared sheet stays read-only when opened from Pharmacy.
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>
            {rx
              ? `${rx.medication}${rx.dose ? ` · ${rx.dose}` : ""}`
              : t("prescriptions.detail.fallbackTitle")}
          </SheetTitle>
        </SheetHeader>
        <SheetPanel className="min-h-0 flex-1">
          {rx && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback>{rx.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {rx.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("prescriptions.detail.fileNumber", {
                      number: rx.fileNumber,
                    })}
                  </span>
                </div>
                <Badge className="ms-auto" variant={statusVariant[rx.status]}>
                  {t(`prescriptions.status.${rx.status}`)}
                </Badge>
              </div>

              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.medication")}
                </dt>
                <dd className="text-foreground">{rx.medication}</dd>
                {rx.dose && (
                  <>
                    <dt className="text-muted-foreground">
                      {t("prescriptions.detail.dose")}
                    </dt>
                    <dd className="text-foreground">{rx.dose}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.frequency")}
                </dt>
                <dd className="text-foreground">{rx.frequency}</dd>
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.duration")}
                </dt>
                <dd className="text-foreground">{rx.duration || "—"}</dd>
                {(rx.startDate || rx.endDate) && (
                  <>
                    <dt className="text-muted-foreground">
                      {t("prescriptions.detail.courseDates")}
                    </dt>
                    <dd className="text-foreground">
                      {[
                        rx.startDate ? formatPrescribedAt(rx.startDate) : null,
                        rx.endDate ? formatPrescribedAt(rx.endDate) : null,
                      ]
                        .filter(Boolean)
                        .join(" → ") || "—"}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.prescriber")}
                </dt>
                <dd className="text-foreground">{rx.prescriber}</dd>
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.date")}
                </dt>
                <dd className="text-foreground">
                  {formatPrescribedAt(rx.prescribedAt)}
                </dd>
                <dt className="text-muted-foreground">
                  {t("prescriptions.detail.status")}
                </dt>
                <dd className="text-foreground">
                  {t(`prescriptions.status.${rx.status}`)}
                </dd>
              </dl>

              {rx.notes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">
                    {t("prescriptions.detail.notes")}
                  </span>
                  <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
                    {rx.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetPanel>
        {rx && (
          <SheetFooter>
            {onDelete && (
              <Button
                className="sm:mr-auto"
                onClick={onDelete}
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-4" />
                {t("prescriptions.detail.delete")}
              </Button>
            )}
            <SendToPharmacyButton rxId={rx.id} />
          </SheetFooter>
        )}
      </SheetPopup>
    </Sheet>
  );
}
