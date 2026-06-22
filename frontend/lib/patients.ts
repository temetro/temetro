// Patient domain types + data access for the temetro chat.
//
// The types below are the canonical record shape (also mirrored by the backend
// at backend/src/types/patient.ts). The data functions call the backend's
// org-scoped patient API; the session cookie is sent automatically by the
// shared fetch wrapper.

import { ApiError, apiFetch } from "@/lib/api-client";

export type AllergySeverity = "mild" | "moderate" | "severe";
export type LabFlag = "normal" | "high" | "low" | "critical";

export type Allergy = {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
};

export type Medication = {
  name: string;
  dose: string;
  frequency: string;
};

export type Problem = {
  label: string;
  since: string;
};

export type Vitals = {
  bp: string;
  hr: string;
  temp: string;
  spo2: string;
  takenAt: string;
};

export type Lab = {
  name: string;
  value: string;
  flag: LabFlag;
  takenAt: string;
};

export type Encounter = {
  date: string;
  type: string;
  provider: string;
  summary: string;
};

// A short series for a sparkline. `points` are most-recent-last, so the
// latest reading is points.at(-1).
export type Trend = {
  label: string;
  unit: string;
  points: number[];
};

export type Patient = {
  fileNumber: string; // MRN / file number, e.g. "10293"
  name: string;
  age: number;
  sex: "M" | "F";
  pcp: string; // primary care provider (display name)
  primaryProviderId?: string | null; // user id of the responsible clinician
  status: "active" | "inpatient" | "discharged";
  initials: string; // for AvatarFallback
  allergies: Allergy[];
  alerts: string[];
  medications: Medication[];
  problems: Problem[];
  vitals: Vitals;
  vitalsTrend: Trend; // headline vital plotted as a sparkline
  labs: Lab[];
  labTrend: Trend; // headline lab plotted as a sparkline
  encounters: Encounter[];
  source?: "manual" | "ai"; // "ai" = imported/drafted by the chat agent
  // Set when imported from a patient wallet as a temporary share — the ISO
  // deadline after which the record is auto-deleted from the clinic.
  shareExpiresAt?: string | null;
};

// Fetch one patient in the active clinic. Returns null when not found (404).
export async function getPatient(fileNumber: string): Promise<Patient | null> {
  try {
    return await apiFetch<Patient>(
      `/api/patients/${encodeURIComponent(fileNumber.trim())}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// Every patient in the active clinic.
export async function listPatients(): Promise<Patient[]> {
  return apiFetch<Patient[]>("/api/patients");
}

// Create a new patient. Throws ApiError(409) if the file number is taken.
export async function createPatient(patient: Patient): Promise<Patient> {
  return apiFetch<Patient>("/api/patients", {
    method: "POST",
    body: JSON.stringify(patient),
  });
}

// Replace an existing patient's full record.
export async function updatePatient(patient: Patient): Promise<Patient> {
  return apiFetch<Patient>(
    `/api/patients/${encodeURIComponent(patient.fileNumber)}`,
    {
      method: "PUT",
      body: JSON.stringify(patient),
    },
  );
}

// Append lab results to a patient's record without touching the rest of it.
// Backed by POST /api/patients/:fileNumber/labs (gated by `lab:write`, so lab
// staff can submit analyses without patient-edit rights).
export async function appendLabs(
  fileNumber: string,
  labs: Lab[],
): Promise<Patient> {
  return apiFetch<Patient>(
    `/api/patients/${encodeURIComponent(fileNumber.trim())}/labs`,
    {
      method: "POST",
      body: JSON.stringify({ labs }),
    },
  );
}

// Permanently delete a patient's chart. Backed by DELETE
// /api/patients/:fileNumber (gated by `patient:delete` — the full-clinician
// marker). Resolves on 204; throws ApiError on failure.
export async function deletePatient(fileNumber: string): Promise<void> {
  await apiFetch<void>(
    `/api/patients/${encodeURIComponent(fileNumber.trim())}`,
    { method: "DELETE" },
  );
}

// Remove a single lab result from a patient's record. The lab has no id on the
// client, so it's identified by name + value + takenAt (DELETE
// /api/patients/:fileNumber/labs, gated by `lab:write`). Returns the updated
// patient.
export async function deleteLab(
  fileNumber: string,
  lab: Pick<Lab, "name" | "value" | "takenAt">,
): Promise<Patient> {
  return apiFetch<Patient>(
    `/api/patients/${encodeURIComponent(fileNumber.trim())}/labs`,
    {
      method: "DELETE",
      body: JSON.stringify({
        name: lab.name,
        value: lab.value,
        takenAt: lab.takenAt,
      }),
    },
  );
}

// Reassign a patient to another clinician (sets their primary provider + PCP).
export async function transferPatient(
  fileNumber: string,
  providerId: string,
): Promise<Patient> {
  return apiFetch<Patient>(
    `/api/patients/${encodeURIComponent(fileNumber)}/transfer`,
    {
      method: "POST",
      body: JSON.stringify({ providerId }),
    },
  );
}

// Suggest a unique-ish 5-digit file number for new charts. The server is the
// source of truth and rejects collisions with a 409.
export function generateFileNumber(): string {
  return String(10000 + Math.floor(Math.random() * 89999));
}

// --- Import from a patient wallet app --------------------------------------
// A clinician enters a wallet number; we relay an encrypted-share request to the
// patient's device, the patient approves on their phone, and the decrypted draft
// record comes back for review before it's committed.

export type WalletShareMode = "permanent" | "temporary";

export type WalletShareRequest = {
  id: string;
  walletNumber: string;
  status: "pending" | "approved" | "denied" | "expired";
  shareMode: WalletShareMode;
  shareExpiresAt: string | null;
  draft: Patient | null;
};

// Start an import: relays a share request to the wallet and returns the pending
// request to poll. Throws ApiError(400) on a malformed wallet number.
export async function requestWalletShare(input: {
  walletNumber: string;
  mode: WalletShareMode;
  durationHours?: number;
}): Promise<WalletShareRequest> {
  return apiFetch<WalletShareRequest>("/api/patients/wallet/request-share", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Create a QR pairing request (no wallet number — the patient scans a QR that
// carries this clinic's relay URL + the request). Returns the request plus the
// ephemeral public key the device seals to.
export type WalletPairing = WalletShareRequest & {
  ephemeralPubKey: string;
  // A phone-reachable relay URL the device should connect to (resolved
  // server-side from PUBLIC_RELAY_URL / the request host — not necessarily this
  // browser's API_BASE_URL, which may be localhost).
  relayUrl: string;
};

export async function requestWalletPairing(input: {
  mode: WalletShareMode;
  durationHours?: number;
}): Promise<WalletPairing> {
  return apiFetch<WalletPairing>("/api/patients/wallet/pair", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Poll a request until the patient approves/denies on their device.
export async function pollWalletShare(
  id: string,
): Promise<WalletShareRequest> {
  return apiFetch<WalletShareRequest>(
    `/api/patients/wallet/request-share/${encodeURIComponent(id)}`,
  );
}

// Commit the (possibly clinician-edited) draft into a real patient record. The
// temporary-share deadline is applied server-side from the original request.
export async function commitWalletShare(
  id: string,
  patient: Patient,
): Promise<Patient> {
  return apiFetch<Patient>(
    `/api/patients/wallet/request-share/${encodeURIComponent(id)}/commit`,
    {
      method: "POST",
      body: JSON.stringify(patient),
    },
  );
}
