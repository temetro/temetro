"use client";

import { CircleDollarSign, FileText, Plus, Search, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { InvoiceDetailSheet } from "@/components/invoices/invoice-detail-sheet";
import { InvoiceFormDialog } from "@/components/invoices/invoice-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatInvoiceDate,
  formatMoney,
  type Invoice,
  type InvoiceStatus,
  invoiceTotal,
  listInvoices,
} from "@/lib/invoices";

const statusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  void: "destructive",
};

export function InvoicesView() {
  const { t } = useTranslation();
  const [list, setList] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Invoice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Invoice | null>(null);

  useEffect(() => {
    let active = true;
    listInvoices()
      .then((data) => active && setList(data))
      .catch((err) => {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : t("invoices.loadError"),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  const search = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!search) return list;
    return list.filter(
      (inv) =>
        inv.name.toLowerCase().includes(search) ||
        inv.number.toLowerCase().includes(search) ||
        inv.fileNumber.includes(search) ||
        inv.status.toLowerCase().includes(search),
    );
  }, [list, search]);

  const kpis = useMemo(() => {
    const unpaid = list
      .filter((i) => i.status === "draft" || i.status === "sent")
      .reduce((sum, i) => sum + invoiceTotal(i), 0);
    const paid = list
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + invoiceTotal(i), 0);
    const drafts = list.filter((i) => i.status === "draft").length;
    return [
      {
        label: t("invoices.kpi.outstanding"),
        value: formatMoney(unpaid),
        icon: CircleDollarSign,
      },
      { label: t("invoices.kpi.paid"), value: formatMoney(paid), icon: Wallet },
      {
        label: t("invoices.kpi.drafts"),
        value: String(drafts),
        icon: FileText,
      },
    ];
  }, [list, t]);

  const openInvoice = (inv: Invoice) => {
    setSelected(inv);
    setSheetOpen(true);
  };

  const upsert = (saved: Invoice) => {
    setList((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev];
    });
    setSelected((cur) => (cur?.id === saved.id ? saved : cur));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("invoices.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("invoices.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("invoices.searchPlaceholder")}
              value={query}
            />
          </div>
          <Button
            className="rounded-3xl"
            onClick={() => {
              setFormMode("create");
              setEditing(null);
              setFormOpen(true);
            }}
            type="button"
          >
            <Plus className="size-4" />
            {t("invoices.new")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card className="flex-row items-center gap-3 p-4" key={k.label}>
            <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
              <k.icon className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">{k.label}</span>
              <span className="font-semibold text-foreground text-lg tracking-tight tabular-nums">
                {k.value}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
        {filtered.map((inv) => (
          <button
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
            key={inv.id}
            onClick={() => openInvoice(inv)}
            type="button"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 truncate font-medium text-foreground text-sm">
                {inv.number}
                <span className="font-normal text-muted-foreground">
                  · {inv.name}
                </span>
                <AiBadge source={inv.source} />
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {formatInvoiceDate(inv.issuedAt)}
              </span>
            </div>
            <span className="shrink-0 font-medium text-foreground text-sm tabular-nums">
              {formatMoney(invoiceTotal(inv))}
            </span>
            <Badge variant={statusVariant[inv.status]}>
              {t(`invoices.status.${inv.status}`)}
            </Badge>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-muted-foreground text-sm">
            {loadError
              ? loadError
              : search
                ? t("invoices.noMatches")
                : t("invoices.empty")}
          </p>
        )}
      </div>

      <InvoiceFormDialog
        invoice={editing ?? undefined}
        mode={formMode}
        onOpenChange={setFormOpen}
        onSaved={upsert}
        open={formOpen}
      />

      <InvoiceDetailSheet
        invoice={selected}
        onChanged={upsert}
        onDeleted={(id) => setList((prev) => prev.filter((i) => i.id !== id))}
        onEdit={(inv) => {
          setSheetOpen(false);
          setFormMode("edit");
          setEditing(inv);
          setFormOpen(true);
        }}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
      />
    </div>
  );
}
