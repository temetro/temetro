"use client";

import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InventoryItem } from "@/lib/inventory";

// Read-only inventory card the agent shows for listInventory; low-stock items
// (at or below their reorder threshold) get a destructive badge.
export function InventoryListCard({ items }: { items: InventoryItem[] }) {
  const { t } = useTranslation();
  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Boxes className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{t("chat.lists.inventory")}</span>
        <Badge className="ms-auto" variant="secondary">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-muted-foreground text-sm">
          {t("chat.lists.noInventory")}
        </p>
      ) : (
        <div className="max-h-72 divide-y divide-border overflow-y-auto">
          {items.map((it) => {
            const low = it.stockQuantity <= it.reorderThreshold;
            return (
              <div className="flex items-center gap-3 px-4 py-2.5" key={it.id}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {it.name}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {[it.strength, it.form].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <Badge variant={low ? "destructive" : "outline"}>
                  {it.stockQuantity} {it.unit}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
