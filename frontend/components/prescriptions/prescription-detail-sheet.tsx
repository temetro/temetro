"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Prescription, RxStatus } from "@/components/prescriptions/prescriptions-view";

const statusVariant: Record<
  RxStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  completed: "outline",
  expired: "destructive",
};

const statusLabel: Record<RxStatus, string> = {
  active: "Active",
  completed: "Completed",
  expired: "Expired",
};

// Right-side Sheet showing one prescription's full detail, opened by clicking a
// row in the Prescriptions list (mirrors the Patients table → side Sheet
// pattern). Prescriptions live in local state, so the record is passed in.
export function PrescriptionDetailSheet({
  rx,
  open,
  onOpenChange,
}: {
  rx: Prescription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>
            {rx ? `${rx.medication}${rx.dose ? ` · ${rx.dose}` : ""}` : "Prescription"}
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
                    File #{rx.fileNumber}
                  </span>
                </div>
                <Badge className="ms-auto" variant={statusVariant[rx.status]}>
                  {statusLabel[rx.status]}
                </Badge>
              </div>

              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Medication</dt>
                <dd className="text-foreground">{rx.medication}</dd>
                {rx.dose && (
                  <>
                    <dt className="text-muted-foreground">Dose</dt>
                    <dd className="text-foreground">{rx.dose}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Frequency</dt>
                <dd className="text-foreground">{rx.frequency}</dd>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="text-foreground">{rx.duration || "—"}</dd>
                <dt className="text-muted-foreground">Prescriber</dt>
                <dd className="text-foreground">{rx.prescriber}</dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="text-foreground">{rx.date}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-foreground">{statusLabel[rx.status]}</dd>
              </dl>

              {rx.notes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">Notes</span>
                  <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
                    {rx.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
