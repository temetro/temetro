import { apiFetch } from "@/lib/api-client";

// A prescription. Mirrors the backend `src/types/prescription.ts`. Scoped to the
// active clinic. `prescribedAt` is an ISO YYYY-MM-DD date.
export type RxStatus = "active" | "completed" | "expired";

export type Prescription = {
  id: string;
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  frequency: string;
  prescriber: string;
  prescribedAt: string; // YYYY-MM-DD
  status: RxStatus;
  duration: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// The fields the "New prescription" dialog collects; the backend fills the
// prescriber (from the signed-in user), prescribedAt (today) and status.
export type PrescriptionInput = {
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  frequency: string;
  duration?: string | null;
  notes?: string | null;
  prescriber?: string;
  prescribedAt?: string;
  status?: RxStatus;
};

// "2026-06-05" -> "Jun 5, 2026" (matches the previous mock display format).
export function formatPrescribedAt(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function listPrescriptions(): Promise<Prescription[]> {
  return apiFetch<Prescription[]>("/api/prescriptions");
}

export function createPrescription(
  input: PrescriptionInput,
): Promise<Prescription> {
  return apiFetch<Prescription>("/api/prescriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePrescription(
  id: string,
  input: PrescriptionInput,
): Promise<Prescription> {
  return apiFetch<Prescription>(`/api/prescriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePrescription(id: string): Promise<void> {
  return apiFetch<void>(`/api/prescriptions/${id}`, { method: "DELETE" });
}
