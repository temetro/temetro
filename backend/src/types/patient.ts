// Canonical patient shape — mirrors frontend/lib/patients.ts so API responses
// can be consumed by the chat record cards without any reshaping on the client.

export type AllergySeverity = "mild" | "moderate" | "severe";
export type LabFlag = "normal" | "high" | "low" | "critical";
export type Sex = "M" | "F";
export type PatientStatus = "active" | "inpatient" | "discharged";

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

// A short series for a sparkline; `points` are most-recent-last.
export type Trend = {
  label: string;
  unit: string;
  points: number[];
};

export type Patient = {
  fileNumber: string; // MRN / file number, e.g. "10293"
  name: string;
  age: number;
  sex: Sex;
  pcp: string; // primary care provider (display name)
  primaryProviderId?: string | null; // user id of the responsible clinician
  status: PatientStatus;
  initials: string; // for AvatarFallback
  phone?: string; // contact number (demographic; visible to reception)
  bloodType?: string; // e.g. "O+"; clinical — redacted for reception
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
  // Set when this record was imported from a patient wallet as a *temporary*
  // share — the ISO deadline after which it is auto-deleted from the clinic.
  shareExpiresAt?: string | null;
};
