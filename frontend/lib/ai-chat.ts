import type { UIMessage } from "ai";

import type { Analytics } from "@/lib/analytics";
import type { Appointment } from "@/lib/appointments";
import type { InventoryItem } from "@/lib/inventory";
import type { Lab, Patient, Trend } from "@/lib/patients";
import type { Prescription } from "@/lib/prescriptions";
import type { Task } from "@/lib/tasks";

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
  // Every parsed record (originals), so the clinician can edit any row.
  records: unknown[];
  // Validated, ready-to-commit records (server re-validates on commit).
  valid: unknown[];
  // Skipped rows, with their errors and the original record (for editing).
  invalid: { index: number; errors: string[]; record: unknown }[];
  total: number;
  // Set by the client once imported/discarded so the card stays locked across
  // re-render and conversation reload.
  resolved?: "added" | "discarded";
};

export type VeilNoticeData = {
  provider: string;
  level: string;
};

// A Chain-of-Thought step the agent emits as it works (one per tool action).
export type StepData = {
  id: string;
  label: string;
  status: "active" | "complete";
};

// A citable source the agent retrieved (one per display-tool call). The model
// references it inline via a [[src:id]] marker; the client renders that marker
// as an inline citation chip and a sources footer. `title` is the real,
// clinician-facing label; `id` is PHI-free (s1, s2, …).
export type SourceData = {
  id: string;
  title: string;
  kind: string;
};

// Read-only list cards (display actions).
export type AppointmentListData = { appointments: Appointment[] };
export type TaskListData = { tasks: Task[] };
export type PrescriptionListData = { prescriptions: Prescription[] };
export type InventoryListData = { items: InventoryItem[] };

// Clinic-wide read cards.
export type ClinicCardData = {
  name: string;
  slug: string | null;
  createdAt: string | null;
};

// An add proposed by the agent, awaiting one-click clinician approval. `record`
// is the validated, ready-to-commit input for the matching create endpoint.
export type ActionPreviewKind =
  | "appointment"
  | "task"
  | "prescription"
  | "invoice"
  | "inventory";
export type ActionPreviewData = {
  token: string;
  kind: ActionPreviewKind;
  record: unknown;
  issues?: string[];
  // Set by the client once committed/discarded so the card stays locked across
  // re-render and conversation reload (prevents a duplicate add).
  resolved?: "added" | "discarded";
};

// Maps each data part name → its payload. Part `type` strings are the key
// prefixed with `data-` (e.g. `data-patientCard`), per the AI SDK convention.
export type TemetroDataParts = {
  patientCard: Patient;
  // The same patient rendered as an Obsidian-style problems↔visits graph (Graph
  // mode). Carries the full record so the graph renders client-side.
  recordGraph: Patient;
  labCard: LabCardData;
  importPreview: ImportPreviewData;
  veilNotice: VeilNoticeData;
  step: StepData;
  source: SourceData;
  appointmentList: AppointmentListData;
  taskList: TaskListData;
  prescriptionList: PrescriptionListData;
  inventoryList: InventoryListData;
  clinicCard: ClinicCardData;
  analyticsCard: Analytics;
  actionPreview: ActionPreviewData;
};

export type TemetroUIMessage = UIMessage<never, TemetroDataParts>;
