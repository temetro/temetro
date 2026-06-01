// UI-only patient fixtures for the temetro chat demo.
// There is no backend yet — `getPatient` is an async wrapper over a static
// fixture so call sites already look like a real fetch and can be swapped for
// an API call later. All data below is fictional sample data.

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
  pcp: string; // primary care provider
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
};

const PATIENTS: Record<string, Patient> = {
  "10293": {
    fileNumber: "10293",
    name: "Amina Hassan",
    age: 64,
    sex: "F",
    pcp: "Dr. Lena Ortiz",
    status: "active",
    initials: "AH",
    allergies: [
      { substance: "Penicillin", reaction: "Anaphylaxis", severity: "severe" },
      { substance: "Sulfa drugs", reaction: "Rash", severity: "moderate" },
    ],
    alerts: ["Anticoagulated", "Fall risk"],
    medications: [
      { name: "Metformin", dose: "1000 mg", frequency: "twice daily" },
      { name: "Lisinopril", dose: "20 mg", frequency: "once daily" },
      { name: "Apixaban", dose: "5 mg", frequency: "twice daily" },
      { name: "Atorvastatin", dose: "40 mg", frequency: "at bedtime" },
    ],
    problems: [
      { label: "Type 2 diabetes mellitus", since: "2014" },
      { label: "Atrial fibrillation", since: "2019" },
      { label: "Hypertension", since: "2011" },
      { label: "Hyperlipidemia", since: "2015" },
    ],
    vitals: {
      bp: "148/86 mmHg",
      hr: "78 bpm",
      temp: "37.0 °C",
      spo2: "97%",
      takenAt: "May 28, 2026",
    },
    vitalsTrend: {
      label: "Heart rate",
      unit: "bpm",
      points: [72, 75, 74, 79, 83, 80, 78],
    },
    labs: [
      { name: "HbA1c", value: "8.2 %", flag: "high", takenAt: "May 20, 2026" },
      { name: "eGFR", value: "52 mL/min", flag: "low", takenAt: "May 20, 2026" },
      { name: "Potassium", value: "4.4 mmol/L", flag: "normal", takenAt: "May 20, 2026" },
      { name: "INR", value: "2.6", flag: "normal", takenAt: "May 20, 2026" },
    ],
    labTrend: {
      label: "HbA1c",
      unit: "%",
      points: [9.4, 9.1, 8.8, 8.6, 8.2],
    },
    encounters: [
      {
        date: "May 28, 2026",
        type: "Clinic visit",
        provider: "Dr. Lena Ortiz",
        summary: "Diabetes follow-up; metformin dose increased.",
      },
      {
        date: "Mar 12, 2026",
        type: "Cardiology",
        provider: "Dr. Raj Patel",
        summary: "AF stable on apixaban; rate well controlled.",
      },
      {
        date: "Jan 04, 2026",
        type: "Emergency",
        provider: "Dr. S. Cole",
        summary: "Presented with palpitations; discharged same day.",
      },
    ],
  },
  "20481": {
    fileNumber: "20481",
    name: "Daniel Okoro",
    age: 47,
    sex: "M",
    pcp: "Dr. Priya Nair",
    status: "inpatient",
    initials: "DO",
    allergies: [
      { substance: "Codeine", reaction: "Nausea", severity: "mild" },
    ],
    alerts: ["Isolation — MRSA"],
    medications: [
      { name: "Piperacillin-tazobactam", dose: "4.5 g", frequency: "every 8 hours" },
      { name: "Enoxaparin", dose: "40 mg", frequency: "once daily" },
      { name: "Pantoprazole", dose: "40 mg", frequency: "once daily" },
    ],
    problems: [
      { label: "Community-acquired pneumonia", since: "2026" },
      { label: "COPD", since: "2018" },
      { label: "Former smoker", since: "2010" },
    ],
    vitals: {
      bp: "112/70 mmHg",
      hr: "94 bpm",
      temp: "38.4 °C",
      spo2: "92%",
      takenAt: "May 31, 2026",
    },
    vitalsTrend: {
      label: "Heart rate",
      unit: "bpm",
      points: [88, 91, 96, 99, 97, 95, 94],
    },
    labs: [
      { name: "WBC", value: "14.8 ×10⁹/L", flag: "high", takenAt: "May 31, 2026" },
      { name: "CRP", value: "112 mg/L", flag: "critical", takenAt: "May 31, 2026" },
      { name: "Lactate", value: "1.8 mmol/L", flag: "normal", takenAt: "May 31, 2026" },
      { name: "Hemoglobin", value: "11.9 g/dL", flag: "low", takenAt: "May 31, 2026" },
    ],
    labTrend: {
      label: "CRP",
      unit: "mg/L",
      points: [38, 64, 98, 126, 112],
    },
    encounters: [
      {
        date: "May 30, 2026",
        type: "Admission",
        provider: "Dr. Priya Nair",
        summary: "Admitted with febrile pneumonia; IV antibiotics started.",
      },
      {
        date: "Feb 18, 2026",
        type: "Pulmonology",
        provider: "Dr. M. Adeyemi",
        summary: "COPD review; inhaler technique reinforced.",
      },
    ],
  },
  "30574": {
    fileNumber: "30574",
    name: "Grace Liang",
    age: 29,
    sex: "F",
    pcp: "Dr. Tom Becker",
    status: "active",
    initials: "GL",
    allergies: [],
    alerts: ["Pregnant — 2nd trimester"],
    medications: [
      { name: "Prenatal vitamins", dose: "1 tab", frequency: "once daily" },
      { name: "Levothyroxine", dose: "75 mcg", frequency: "once daily" },
    ],
    problems: [
      { label: "Pregnancy (G1P0, 22 weeks)", since: "2026" },
      { label: "Hypothyroidism", since: "2021" },
    ],
    vitals: {
      bp: "118/72 mmHg",
      hr: "82 bpm",
      temp: "36.8 °C",
      spo2: "99%",
      takenAt: "May 26, 2026",
    },
    vitalsTrend: {
      label: "Heart rate",
      unit: "bpm",
      points: [78, 80, 79, 83, 85, 84, 82],
    },
    labs: [
      { name: "TSH", value: "2.1 mIU/L", flag: "normal", takenAt: "May 19, 2026" },
      { name: "Hemoglobin", value: "11.2 g/dL", flag: "low", takenAt: "May 19, 2026" },
      { name: "Fasting glucose", value: "84 mg/dL", flag: "normal", takenAt: "May 19, 2026" },
    ],
    labTrend: {
      label: "Hemoglobin",
      unit: "g/dL",
      points: [12.4, 12.0, 11.7, 11.4, 11.2],
    },
    encounters: [
      {
        date: "May 26, 2026",
        type: "Antenatal visit",
        provider: "Dr. Tom Becker",
        summary: "Routine 22-week check; fetal growth on track.",
      },
      {
        date: "Apr 14, 2026",
        type: "Obstetrics",
        provider: "Dr. Tom Becker",
        summary: "Anatomy scan normal; thyroid dose unchanged.",
      },
    ],
  },
};

export const SAMPLE_FILE_NUMBERS = Object.keys(PATIENTS);

export async function getPatient(fileNumber: string): Promise<Patient | null> {
  // Simulate retrieval latency so the loading (skeleton) state is visible.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return PATIENTS[fileNumber.trim()] ?? null;
}

// Generate a unique 5-digit file number not already in the store.
export function generateFileNumber(): string {
  let candidate: string;
  do {
    candidate = String(10000 + Math.floor(Math.random() * 89999));
  } while (candidate in PATIENTS);
  return candidate;
}

// Add (or replace) a patient in the in-memory store. Session-only — no backend
// yet, so this resets on reload. Swap point for a real "create patient" API.
export function addPatient(patient: Patient): void {
  PATIENTS[patient.fileNumber] = patient;
}
