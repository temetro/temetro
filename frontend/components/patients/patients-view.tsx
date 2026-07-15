"use client";

import { MoreHorizontal, Plus, Search, Smartphone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AiBadge } from "@/components/ai-badge";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { ImportFromWalletDialog } from "@/components/patients/import-from-wallet-dialog";
import { PatientDetailSheet } from "@/components/patients/patient-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardFrame } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPatients, type Patient } from "@/lib/patients";

type StatusFilter = "all" | Patient["status"];
const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "active",
  "inpatient",
  "discharged",
];

// Rows shown per page on the patients table before paginating.
const PAGE_SIZE = 10;

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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

  // Runs once on mount, and `loading` already starts true, so there's nothing
  // to flip synchronously here.
  useEffect(() => {
    let active = true;
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
    // `t` intentionally omitted: it is only read to build a failure message,
    // and re-fetching on a language change would be pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = query.trim().toLowerCase();
  // Search matches name, MRN, problem/condition labels, and allergy substances;
  // the status filter narrows to one clinical status.
  const patients = allPatients.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.fileNumber.includes(q) ||
      p.problems.some((problem) => problem.label.toLowerCase().includes(q)) ||
      p.allergies.some((a) => a.substance.toLowerCase().includes(q))
    );
  });

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
            <Search className="-translate-y-1/2 absolute top-1/2 start-3 size-4 text-muted-foreground" />
            <Input
              className="w-full ps-9 sm:w-64"
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
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            type="button"
          >
            <Plus className="size-4" />
            {t("patients.add")}
          </Button>
          {/* Secondary actions tuck into an overflow menu so the toolbar keeps a
              single primary CTA. */}
          <Menu>
            <MenuTrigger
              render={
                <Button
                  aria-label={t("patients.moreActions")}
                  className="rounded-full"
                  size="icon"
                  type="button"
                  variant="outline"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={() => setImportOpen(true)}>
                <Smartphone className="size-4" />
                {t("patients.importFromApp")}
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>

      {/* Filter sits on its own row just above the table so the toolbar stays a
          clean title + search + primary actions cluster. */}
      <div className="mt-8 flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          {t("patients.filterLabel")}
        </span>
        <Select
          onValueChange={(value) => {
            setStatusFilter((value ?? "all") as StatusFilter);
            setPage(1);
          }}
          value={statusFilter}
        >
          <SelectTrigger
            aria-label={t("patients.filterStatus")}
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {STATUS_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {value === "all"
                  ? t("patients.allStatuses")
                  : t(`patients.status.${value}`)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      <CardFrame className="mt-4 w-full">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4 text-xs uppercase">
                {t("patients.columns.name")}
              </TableHead>
              <TableHead className="text-xs uppercase">
                {t("patients.columns.mrn")}
              </TableHead>
              <TableHead className="text-xs uppercase">
                {t("patients.columns.ageSex")}
              </TableHead>
              <TableHead className="text-xs uppercase">
                {t("patients.columns.status")}
              </TableHead>
              <TableHead className="text-xs uppercase">
                {t("patients.columns.lastSeen")}
              </TableHead>
              <TableHead className="pe-4 text-xs uppercase">
                {t("patients.columns.allergies")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {t("patients.loading")}
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-destructive"
                  colSpan={6}
                >
                  {loadError}
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-10 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {t("patients.empty")}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((p) => (
                <TableRow
                  className="cursor-pointer"
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
                  <TableCell className="ps-4 py-3 font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      {p.name}
                      <AiBadge source={p.source} />
                      {p.shareExpiresAt ? (
                        <Badge variant="outline">
                          {t("patients.tempBadge")}
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {p.fileNumber}
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {p.age} · {p.sex}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={statusVariant[p.status]}>
                      {t(`patients.status.${p.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground">
                    {p.encounters[0]?.date ?? "—"}
                  </TableCell>
                  <TableCell className="pe-4 py-3 text-muted-foreground">
                    {p.allergies.length || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardFrame>

      {!loading && !loadError ? (
        <ListPagination
          onPageChange={setPage}
          page={safePage}
          pageSize={PAGE_SIZE}
          total={patients.length}
        />
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
