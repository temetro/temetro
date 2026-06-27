import { apiFetch } from "@/lib/api-client";

// An audit-log entry. Mirrors the backend `src/types/activity.ts`. A plain,
// tamper-evident trail of record changes in the active clinic. (The signing /
// patient-approval vision is separate and not built yet.)
export type ActivityEntityType =
  | "patient"
  | "note"
  | "appointment"
  | "prescription"
  | "task";

export type ActivityEntry = {
  id: string;
  actorName: string;
  actorInitials: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  patientName: string | null;
  patientFileNumber: string | null;
  createdAt: string;
};

export function listActivity(): Promise<ActivityEntry[]> {
  return apiFetch<ActivityEntry[]>("/api/activity");
}

// A single patient's record history (every clinician's adds/changes on it).
export function listPatientActivity(
  fileNumber: string,
): Promise<ActivityEntry[]> {
  return apiFetch<ActivityEntry[]>(
    `/api/activity/patient/${encodeURIComponent(fileNumber)}`,
  );
}
