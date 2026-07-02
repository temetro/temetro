"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

// Page numbers to render, with `null` marking an ellipsis gap. Keeps the first,
// last, and a small window around the current page so the control stays compact
// even with many pages.
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | null)[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push(null);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push(null);
  pages.push(total);
  return pages;
}

type ListPaginationProps = {
  /** Current (already-clamped) page, 1-based. */
  page: number;
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
  onPageChange: (page: number) => void;
};

// Shared client-side pagination control (summary line + prev/page/next nav).
// Renders nothing when everything fits on one page. Used by the Patients,
// Activity and Invoices lists.
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: ListPaginationProps) {
  const { t } = useTranslation();
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        {t("common.pagination.summary", {
          from: (safePage - 1) * pageSize + 1,
          to: Math.min(safePage * pageSize, total),
          total,
        })}
      </p>
      <Pagination
        aria-label={t("common.pagination.label")}
        className="mx-0 w-auto justify-end"
      >
        <PaginationContent>
          <PaginationItem>
            <Button
              aria-label={t("common.pagination.previous")}
              className="gap-1"
              disabled={safePage === 1}
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span className="max-sm:hidden">
                {t("common.pagination.previous")}
              </span>
            </Button>
          </PaginationItem>
          {pageWindow(safePage, totalPages).map((p, i) =>
            p === null ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <Button
                  aria-current={p === safePage ? "page" : undefined}
                  aria-label={t("common.pagination.page", { page: p })}
                  onClick={() => onPageChange(p)}
                  size="icon-sm"
                  type="button"
                  variant={p === safePage ? "outline" : "ghost"}
                >
                  {p}
                </Button>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <Button
              aria-label={t("common.pagination.next")}
              className="gap-1"
              disabled={safePage === totalPages}
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span className="max-sm:hidden">
                {t("common.pagination.next")}
              </span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
