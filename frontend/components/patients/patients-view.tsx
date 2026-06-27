"use client";

import { ChevronLeft, ChevronRight, Plus, Search, Smartphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { ImportFromWalletDialog } from "@/components/patients/import-from-wallet-dialog";
import { PatientDetailSheet } from "@/components/patients/patient-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { listPatients, type Patient } from "@/lib/patients";

// Rows shown per page on the patients table before paginating.
const PAGE_SIZE = 10;

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

type BadgeVariant = "success" | "info" | "outline";

// Colour the status for at-a-glance scanning: active patients read as success
// (green), admitted inpatients as info (blue, draws the eye), and discharged as
// a muted outline.
const statusVariant: Record<Patient["status"], BadgeVariant> = {
  active: "success",
  inpatient: "info",
  discharged: "outline",
};

export function PatientsView() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Bumped on open so the create dialog remounts with a fresh file # / form.
  const [addKey, setAddKey] = useState(0);

  // The patient whose record is shown in the side Sheet.
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPatients()
      .then((data) => {
        if (!active) return;
        setAllPatients(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : t("patients.loadError")
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const patients = allPatients.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.fileNumber.includes(q)
  );

  // Client-side pagination over the filtered list (10/page). Searching resets to
  // the first page (done in the search handler); `page` is clamped at render so a
  // shrinking list (filter/refresh) never leaves us past the last page.
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = patients.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const open = (fileNumber: string) => {
    setSelected(fileNumber);
    setSheetOpen(true);
  };

  // Deep link from a notification: /patients?file=<fileNumber> opens the record.
  const searchParams = useSearchParams();
  const deepLinkFile = searchParams.get("file");
  const openedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkFile || openedDeepLink.current === deepLinkFile) return;
    openedDeepLink.current = deepLinkFile;
    open(deepLinkFile);
  }, [deepLinkFile]);

  const refresh = () => {
    void listPatients()
      .then(setAllPatients)
      .catch(() => {
        /* keep the current list on a refresh error */
      });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("patients.title")}
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 sm:w-64"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              onKeyDown={(event) => {
                // Enter opens the top match's record, like picking it from the table.
                if (event.key === "Enter" && patients.length > 0) {
                  event.preventDefault();
                  open(patients[0].fileNumber);
                }
              }}
              placeholder={t("patients.searchPlaceholder")}
              value={query}
            />
          </div>
          <Button
            className="rounded-3xl"
            onClick={() => setImportOpen(true)}
            type="button"
            variant="outline"
          >
            <Smartphone className="size-4" />
            {t("patients.importFromApp")}
          </Button>
          <Button
            className="rounded-3xl"
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            type="button"
          >
            <Plus className="size-4" />
            {t("patients.add")}
          </Button>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-left text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">{t("patients.columns.name")}</th>
              <th className="px-4 py-3 font-medium">{t("patients.columns.mrn")}</th>
              <th className="px-4 py-3 font-medium">
                {t("patients.columns.ageSex")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("patients.columns.status")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("patients.columns.lastSeen")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("patients.columns.allergies")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {t("patients.loading")}
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td className="px-4 py-10 text-center text-destructive" colSpan={6}>
                  {loadError}
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {t("patients.empty")}
                </td>
              </tr>
            ) : (
              pageRows.map((p) => (
                <tr
                  className="cursor-pointer border-border/50 border-b transition-colors last:border-0 hover:bg-accent/50"
                  key={p.fileNumber}
                  onClick={() => open(p.fileNumber)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open(p.fileNumber);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      {p.name}
                      <AiBadge source={p.source} />
                      {p.shareExpiresAt ? (
                        <Badge variant="outline">
                          {t("patients.tempBadge")}
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.fileNumber}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.age} · {p.sex}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[p.status]}>
                      {t(`patients.status.${p.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.encounters[0]?.date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.allergies.length || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !loadError && patients.length > PAGE_SIZE ? (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            {t("patients.pagination.summary", {
              from: (safePage - 1) * PAGE_SIZE + 1,
              to: Math.min(safePage * PAGE_SIZE, patients.length),
              total: patients.length,
            })}
          </p>
          <Pagination
            aria-label={t("patients.pagination.label")}
            className="mx-0 w-auto justify-end"
          >
            <PaginationContent>
              <PaginationItem>
                <Button
                  aria-label={t("patients.pagination.previous")}
                  className="gap-1"
                  disabled={safePage === 1}
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronLeft className="size-4" />
                  <span className="max-sm:hidden">
                    {t("patients.pagination.previous")}
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
                      aria-label={t("patients.pagination.page", { page: p })}
                      onClick={() => setPage(p)}
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
                  aria-label={t("patients.pagination.next")}
                  className="gap-1"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <span className="max-sm:hidden">
                    {t("patients.pagination.next")}
                  </span>
                  <ChevronRight className="size-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}

      <PatientFormDialog
        key={addKey}
        mode="create"
        onCreated={(fileNumber) => {
          refresh();
          open(fileNumber);
        }}
        onOpenChange={setAddOpen}
        open={addOpen}
      />

      <ImportFromWalletDialog
        onImported={(fileNumber) => {
          refresh();
          open(fileNumber);
        }}
        onOpenChange={setImportOpen}
        open={importOpen}
      />

      <PatientDetailSheet
        fileNumber={selected}
        onOpenChange={(o) => {
          setSheetOpen(o);
          // Reflect any edits made in the Sheet back into the table.
          if (!o) refresh();
        }}
        open={sheetOpen}
      />
    </div>
  );
}
