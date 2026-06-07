"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import { PatientDetailSheet } from "@/components/patients/patient-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPatients, type Patient } from "@/lib/patients";

type BadgeVariant = "secondary" | "destructive" | "outline";

const statusVariant: Record<Patient["status"], BadgeVariant> = {
  active: "secondary",
  inpatient: "destructive",
  discharged: "outline",
};

export function PatientsView() {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
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
          err instanceof Error ? err.message : "Failed to load patients."
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

  const open = (fileNumber: string) => {
    setSelected(fileNumber);
    setSheetOpen(true);
  };

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
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              className="w-full pl-9 sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Enter opens the top match's record, like picking it from the table.
                if (event.key === "Enter" && patients.length > 0) {
                  event.preventDefault();
                  open(patients[0].fileNumber);
                }
              }}
              placeholder="Search name or MRN"
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
            Add patient
          </Button>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-left text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">MRN</th>
              <th className="px-4 py-3 font-medium">Age · Sex</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3 font-medium">Allergies</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="px-4 py-10 text-center text-muted-foreground"
                  colSpan={6}
                >
                  Loading patients…
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
                  No patients found.
                </td>
              </tr>
            ) : (
              patients.map((p) => (
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
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.fileNumber}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.age} · {p.sex}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="capitalize" variant={statusVariant[p.status]}>
                      {p.status}
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
