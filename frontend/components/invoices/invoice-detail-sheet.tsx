"use client";

import {
  CircleCheck,
  Download,
  Pencil,
  Split,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { SubmitClaimButton } from "@/components/integrations/integration-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import {
  deleteInvoice,
  formatInvoiceDate,
  formatMoney,
  type Invoice,
  type InvoiceStatus,
  invoiceTotal,
  isInstallmentOverdue,
  markInvoicePaid,
  payInstallment,
  splitInvoice,
} from "@/lib/invoices";
import { notify } from "@/lib/toast";

const statusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  void: "destructive",
};

export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
  onEdit,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (invoice: Invoice) => void;
  onDeleted: (id: string) => void;
  onEdit: (invoice: Invoice) => void;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCount(3);
  }, [invoice?.id]);

  if (!invoice) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetPopup className="sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>{t("invoices.sheet.fallbackTitle")}</SheetTitle>
          </SheetHeader>
        </SheetPopup>
      </Sheet>
    );
  }

  const total = invoiceTotal(invoice);
  const isPaid = invoice.status === "paid";
  const isSettled = isPaid || invoice.status === "void";
  // The schedule window: the latest installment due date, for the timeframe hint.
  const lastDue = invoice.installments.reduce<string | null>(
    (latest, it) =>
      it.dueAt && (!latest || it.dueAt > latest) ? it.dueAt : latest,
    null,
  );

  const split = async () => {
    setBusy(true);
    try {
      const updated = await splitInvoice(invoice.id, count);
      onChanged(updated);
      notify.success(
        t("invoices.sheet.splitTitle"),
        `${invoice.number} · ${count}`,
      );
    } catch {
      notify.error(
        t("invoices.sheet.splitFailedTitle"),
        t("invoices.sheet.splitFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  const payAll = async () => {
    setBusy(true);
    try {
      const updated = await markInvoicePaid(invoice);
      onChanged(updated);
      notify.success(t("invoices.sheet.paidTitle"), invoice.number);
    } catch {
      notify.error(
        t("invoices.sheet.payFailedTitle"),
        t("invoices.sheet.payFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  const payOne = async (index: number) => {
    setBusy(true);
    try {
      const updated = await payInstallment(invoice, index);
      onChanged(updated);
      notify.success(
        t("invoices.sheet.installmentPaidTitle"),
        invoice.installments[index]?.label ?? invoice.number,
      );
    } catch {
      notify.error(
        t("invoices.sheet.payFailedTitle"),
        t("invoices.sheet.payFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteInvoice(invoice.id);
      onDeleted(invoice.id);
      notify.success(t("invoices.sheet.deletedTitle"), invoice.number);
      onOpenChange(false);
    } catch {
      notify.error(
        t("invoices.sheet.deleteFailedTitle"),
        t("invoices.sheet.deleteFailedBody"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {invoice.number}
            <AiBadge source={invoice.source} />
            <Badge className="ms-auto" variant={statusVariant[invoice.status]}>
              {t(`invoices.status.${invoice.status}`)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <SheetPanel className="min-h-0 flex-1">
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-medium text-foreground text-sm">
                {invoice.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("invoices.dialog.fileNumber", {
                  number: invoice.fileNumber || "—",
                })}
              </p>
            </div>

            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">
                {t("invoices.sheet.issued")}
              </dt>
              <dd className="text-foreground">
                {formatInvoiceDate(invoice.issuedAt)}
              </dd>
              <dt className="text-muted-foreground">
                {t("invoices.sheet.due")}
              </dt>
              <dd className="text-foreground">
                {invoice.dueAt ? formatInvoiceDate(invoice.dueAt) : "—"}
              </dd>
            </dl>

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">
                {t("invoices.sheet.lineItems")}
              </span>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border">
                {invoice.lineItems.map((li, i) => (
                  <div
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional
                    key={i}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {li.description}
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                      {li.quantity} × {formatMoney(li.unitPrice)}
                    </span>
                    <span className="w-20 shrink-0 text-end font-medium text-foreground tabular-nums">
                      {formatMoney(li.quantity * li.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {t("invoices.sheet.total")}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Installments are a payment plan for an open invoice — once it's
                settled there's nothing left to schedule, so hide them. */}
            {isPaid ? null : (
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs">
                  {t("invoices.sheet.installments")}
                </span>
                {invoice.installments.length > 0 ? (
                  <div className="divide-y divide-border overflow-hidden rounded-2xl border">
                    {invoice.installments.map((it, i) => {
                      const overdue = isInstallmentOverdue(it);
                      return (
                        <div
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          // biome-ignore lint/suspicious/noArrayIndexKey: positional
                          key={i}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-foreground">
                              {it.label}
                            </span>
                            {overdue ? (
                              <Badge variant="destructive">
                                {t("invoices.sheet.overdue")}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-muted-foreground text-xs">
                            {it.dueAt ? formatInvoiceDate(it.dueAt) : "—"}
                          </span>
                          <span className="shrink-0 font-medium text-foreground tabular-nums">
                            {formatMoney(it.amount)}
                          </span>
                          {it.paid ? (
                            <Badge className="shrink-0" variant="outline">
                              {t("invoices.sheet.installmentPaid")}
                            </Badge>
                          ) : (
                            <Button
                              className="shrink-0"
                              disabled={busy}
                              onClick={() => payOne(i)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("invoices.sheet.payInstallment")}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("invoices.sheet.noInstallments")}
                  </p>
                )}
                {invoice.installments.length > 0 && lastDue ? (
                  <p className="text-muted-foreground text-xs">
                    {t("invoices.sheet.timeframe", {
                      count: invoice.installments.length,
                      date: formatInvoiceDate(lastDue),
                    })}
                  </p>
                ) : null}
                <div className="flex items-end gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-xs">
                      {t("invoices.sheet.splitCount")}
                    </span>
                    <Input
                      className="w-20"
                      max={36}
                      min={1}
                      onChange={(e) => setCount(Number(e.target.value) || 1)}
                      type="number"
                      value={count}
                    />
                  </label>
                  <Button
                    disabled={busy}
                    onClick={split}
                    type="button"
                    variant="outline"
                  >
                    <Split className="size-4" />
                    {t("invoices.sheet.split")}
                  </Button>
                </div>
              </div>
            )}

            {invoice.notes ? (
              <p className="whitespace-pre-wrap text-foreground text-sm leading-relaxed">
                {invoice.notes}
              </p>
            ) : null}
          </div>
        </SheetPanel>

        <SheetFooter className="flex-row flex-wrap justify-between gap-2">
          <Button
            disabled={busy}
            onClick={remove}
            type="button"
            variant="destructive"
          >
            <Trash2 className="size-4" />
            {t("invoices.sheet.delete")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => downloadInvoicePdf(invoice)}
              type="button"
              variant="outline"
            >
              <Download className="size-4" />
              {t("invoices.sheet.download")}
            </Button>
            <SubmitClaimButton invoiceId={invoice.id} />
            {isSettled ? null : (
              <Button disabled={busy} onClick={payAll} type="button">
                <CircleCheck className="size-4" />
                {t("invoices.sheet.markPaid")}
              </Button>
            )}
            <Button
              onClick={() => onEdit(invoice)}
              type="button"
              variant={isSettled ? "default" : "outline"}
            >
              <Pencil className="size-4" />
              {t("invoices.sheet.edit")}
            </Button>
          </div>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}
