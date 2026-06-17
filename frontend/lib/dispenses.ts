import { apiFetch } from "@/lib/api-client";

// A dispensing event — the record of a medication handed to a patient at the
// pharmacy. Mirrors the backend `src/types/dispense.ts`. Scoped to the active
// clinic; patient + dispenser fields are denormalized for display.
export type Dispense = {
  id: string;
  fileNumber: string;
  name: string;
  initials: string;
  medication: string;
  dose: string;
  quantity: number;
  unit: string;
  prescriptionId: string | null;
  dispensedBy: string | null;
  dispensedByName: string;
  dispensedAt: string; // ISO timestamp
  notes: string | null;
  createdAt: string;
};

// The fields the dispense action collects; the backend fills the dispenser
// identity (from the signed-in user) and the timestamp.
export type DispenseInput = {
  fileNumber: string;
  name: string;
  initials?: string;
  medication: string;
  dose?: string;
  quantity?: number;
  unit?: string;
  prescriptionId?: string | null;
  notes?: string | null;
};

export function listDispenses(): Promise<Dispense[]> {
  return apiFetch<Dispense[]>("/api/dispenses");
}

export function createDispense(input: DispenseInput): Promise<Dispense> {
  return apiFetch<Dispense>("/api/dispenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteDispense(id: string): Promise<void> {
  return apiFetch<void>(`/api/dispenses/${id}`, { method: "DELETE" });
}
