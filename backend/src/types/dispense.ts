// The canonical Dispense shape returned by the API. Mirrors the frontend
// `lib/dispenses.ts` Dispense type. Scoped to the active clinic; patient and
// dispenser fields are denormalized for display.
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
