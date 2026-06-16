"use client";

import { AlertTriangle, Boxes, PackageX, Pill, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddInventoryDialog } from "@/components/pharmacy/add-inventory-dialog";
import { InventoryDetailDialog } from "@/components/pharmacy/inventory-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type Availability,
  type InventoryInput,
  type InventoryItem,
  availabilityOf,
  createInventory,
  listInventory,
} from "@/lib/inventory";
import { notify } from "@/lib/toast";

const availabilityVariant: Record<
  Availability,
  "success" | "warning" | "destructive"
> = {
  "in-stock": "success",
  low: "warning",
  out: "destructive",
};

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Pill;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-semibold text-foreground text-lg tracking-tight">
          {value}
        </span>
      </div>
    </Card>
  );
}

function ItemRow({
  item,
  onOpen,
}: {
  item: InventoryItem;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const availability = availabilityOf(item);
  const descriptor = [item.strength, item.form].filter(Boolean).join(" · ");
  return (
    <div
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Pill className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground text-sm">
          {item.name}
          {descriptor && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {descriptor}
            </span>
          )}
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {t("inventory.stock", {
            count: item.stockQuantity,
            unit: item.unit || "units",
          })}
          {item.reorderThreshold > 0 &&
            ` · ${t("inventory.reorderAt", { count: item.reorderThreshold })}`}
          {item.location && ` · ${t("inventory.location", { location: item.location })}`}
        </span>
      </div>
      <Badge className="shrink-0" variant={availabilityVariant[availability]}>
        {t(`inventory.availability.${availability}`)}
      </Badge>
    </div>
  );
}

// The pharmacy inventory page: a searchable view of the clinic's medication
// stock with at-a-glance availability. Pharmacy holds inventory read/write;
// this view is read/search only (stock edits are a later step).
export function InventoryView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openItem = (item: InventoryItem) => {
    setSelected(item);
    setDetailOpen(true);
  };

  // Persist a new item, then prepend the saved record so it appears immediately.
  const addItem = async (input: InventoryInput) => {
    try {
      const created = await createInventory(input);
      setItems((prev) => [created, ...prev]);
    } catch {
      notify.error(
        t("inventory.dialog.failedTitle"),
        t("inventory.dialog.failedBody"),
      );
    }
  };

  useEffect(() => {
    let active = true;
    listInventory()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        /* api-client redirects on 401; otherwise leave the list empty */
      });
    return () => {
      active = false;
    };
  }, []);

  const search = query.trim().toLowerCase();
  const results = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (!search) return sorted;
    return sorted.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.form.toLowerCase().includes(search) ||
        item.strength.toLowerCase().includes(search) ||
        item.location.toLowerCase().includes(search),
    );
  }, [items, search]);

  const lowCount = items.filter((i) => availabilityOf(i) === "low").length;
  const outCount = items.filter((i) => availabilityOf(i) === "out").length;

  const kpis = [
    { label: t("inventory.kpi.total"), value: String(items.length), icon: Boxes },
    { label: t("inventory.kpi.low"), value: String(lowCount), icon: AlertTriangle },
    { label: t("inventory.kpi.out"), value: String(outCount), icon: PackageX },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("inventory.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("inventory.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("inventory.searchPlaceholder")}
              value={query}
            />
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t("inventory.addItem")}
          </Button>
        </div>
      </div>

      <AddInventoryDialog
        onAdd={addItem}
        onOpenChange={setAddOpen}
        open={addOpen}
      />

      <InventoryDetailDialog
        item={selected}
        onOpenChange={setDetailOpen}
        open={detailOpen}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg tracking-tight">
            {t("inventory.list.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("inventory.list.description")}
          </p>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {results.map((item) => (
            <ItemRow item={item} key={item.id} onOpen={() => openItem(item)} />
          ))}
          {results.length === 0 && (
            <p className="p-6 text-center text-muted-foreground text-sm">
              {search
                ? t("inventory.list.noMatches")
                : t("inventory.list.empty")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
