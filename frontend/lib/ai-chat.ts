import type { UIMessage } from "ai";

import type { Lab, Patient, Trend } from "@/lib/patients";

// Custom data parts the backend agent streams alongside its text. They carry
// REAL (un-redacted) record data straight to the clinician's screen for rich
// rendering — the model itself only ever sees Veil-redacted tool results.

export type LabCardData = {
  fileNumber: string;
  name: string;
  labs: Lab[];
  labTrend: Trend;
};

export type ImportPreviewData = {
  // Validated, ready-to-commit records (server re-validates on commit).
  valid: unknown[];
  invalid: { index: number; errors: string[] }[];
  total: number;
};

export type VeilNoticeData = {
  provider: string;
  level: string;
};

// Maps each data part name → its payload. Part `type` strings are the key
// prefixed with `data-` (e.g. `data-patientCard`), per the AI SDK convention.
export type TemetroDataParts = {
  patientCard: Patient;
  labCard: LabCardData;
  importPreview: ImportPreviewData;
  veilNotice: VeilNoticeData;
};

export type TemetroUIMessage = UIMessage<never, TemetroDataParts>;
