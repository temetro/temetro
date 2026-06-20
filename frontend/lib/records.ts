import { apiFetch } from "@/lib/api-client";
import type { Patient } from "@/lib/patients";

// Shape of a temetro records archive (GET /api/settings/records/export).
export type RecordsExport = {
  temetroExport: true;
  version: number;
  exportedAt: string;
  organizationId: string;
  patientCount: number;
  patients: Patient[];
};

// Summary returned by POST /api/settings/records/import.
export type ImportResult = {
  created: number;
  skipped: number;
  total: number;
  errors: string[];
};

export function exportRecords(): Promise<RecordsExport> {
  return apiFetch<RecordsExport>("/api/settings/records/export");
}

export function importRecords(patients: unknown[]): Promise<ImportResult> {
  return apiFetch<ImportResult>("/api/settings/records/import", {
    method: "POST",
    body: JSON.stringify({ patients }),
  });
}

// Trigger a browser download of a JSON archive.
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
