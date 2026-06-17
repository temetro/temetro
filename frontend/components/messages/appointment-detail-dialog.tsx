"use client";

import { CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MessageAttachment } from "@/lib/messages";

// The appointment data carried inside a shared-appointment message. It's a
// point-in-time snapshot, so it survives the appointment later being edited or
// deleted.
type AppointmentSnapshot = Extract<
  MessageAttachment,
  { kind: "appointment" }
>["appointment"];

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-right text-foreground text-sm">{value}</dd>
    </div>
  );
}

// A read-only view of a shared appointment, opened by clicking the card in the
// thread. Works the same for the sender and the recipient.
export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: AppointmentSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const a = appointment;
  const statusLabel = a.status
    ? t(`appointments.status.${a.status}`, { defaultValue: a.status })
    : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            {t("messages.attach.apptDetailTitle")}
          </DialogTitle>
          <DialogDescription>{a.name}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <dl className="flex flex-col gap-2.5">
            <Row
              label={t("messages.attach.apptWhen")}
              value={[a.date, a.time].filter(Boolean).join(" · ")}
            />
            <Row label={t("messages.attach.apptType")} value={a.type} />
            <Row label={t("messages.attach.apptProvider")} value={a.provider} />
            <Row
              label={t("messages.attach.apptPatient")}
              value={a.fileNumber ? `#${a.fileNumber}` : null}
            />
            <Row
              label={t("messages.attach.apptStatus")}
              value={
                statusLabel ? <Badge variant="outline">{statusLabel}</Badge> : null
              }
            />
          </dl>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
