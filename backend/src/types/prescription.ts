// The canonical Prescription shape returned by the API. Mirrors the frontend
// `lib/prescriptions.ts` Prescription type. Scoped to the active clinic; patient
// fields are denormalized for display and `fileNumber` links to a patient.
export type PrescriptionStatus = "active" | "completed" | "expired";

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
  startDate: string | null; // YYYY-MM-DD, optional course start
  endDate: string | null; // YYYY-MM-DD, optional course end (drives expiry)
  status: PrescriptionStatus;
  duration: string | null;
  notes: string | null;
  source: "manual" | "ai";
  createdAt: string;
  updatedAt: string;
};
