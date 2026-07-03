import type { LabFlag } from "../../types/patient.js";
import type {
  AllergyRow,
  AppointmentRow,
  EncounterRow,
  LabRow,
  PatientRow,
  PrescriptionRow,
  ProblemRow,
} from "./queries.js";

// Pure mappers from temetro rows to FHIR R4 JSON. temetro stores clinical values
// as **free text** (no SNOMED/LOINC coding), so every CodeableConcept here is
// `text`-only — valid FHIR, deliberately un-coded (documented in the
// CapabilityStatement and API docs). Resource ids are the rows' own UUIDs so
// they are stable; synthesized vital-sign Observations derive their id from the
// patient UUID.

export type FhirResource = {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
};

// System URIs.
const MRN_SYSTEM = "urn:temetro:mrn";
const INTERPRETATION_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
const OBS_CATEGORY_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/observation-category";
const AGE_EXTENSION =
  "https://temetro.app/fhir/StructureDefinition/patient-age-years";

// A FHIR dateTime from our stored strings. Passes date-only values (`YYYY-MM-DD`)
// through unchanged (valid FHIR dateTime), otherwise parses display strings like
// "Jun 28, 2025" to a full instant. Returns undefined when unparseable.
function fhirDateTime(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function humanName(full: string): Record<string, unknown>[] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [{ text: full }];
  return [{ text: full, family: parts.at(-1), given: parts.slice(0, -1) }];
}

function subjectRef(patient: PatientRow) {
  return { reference: `Patient/${patient.id}`, display: patient.name };
}

// --- Patient ----------------------------------------------------------------

export function patientResource(row: PatientRow): FhirResource {
  return {
    resourceType: "Patient",
    id: row.id,
    identifier: [{ system: MRN_SYSTEM, value: row.fileNumber }],
    active: row.status !== "discharged",
    name: humanName(row.name),
    gender: row.sex === "M" ? "male" : "female",
    // temetro records age, not date of birth; expose it as an extension rather
    // than fabricate a birthDate.
    extension: [{ url: AGE_EXTENSION, valueInteger: row.age }],
  };
}

// --- Observation ------------------------------------------------------------

function interpretation(flag: LabFlag) {
  const map: Record<LabFlag, { code: string; display: string }> = {
    normal: { code: "N", display: "Normal" },
    high: { code: "H", display: "High" },
    low: { code: "L", display: "Low" },
    critical: { code: "HH", display: "Critical high" },
  };
  const { code, display } = map[flag];
  return [{ coding: [{ system: INTERPRETATION_SYSTEM, code, display }] }];
}

export function labObservation(row: LabRow, patient: PatientRow): FhirResource {
  const effective = fhirDateTime(row.takenAt);
  return {
    resourceType: "Observation",
    id: row.id,
    status: "final",
    category: [
      {
        coding: [
          {
            system: OBS_CATEGORY_SYSTEM,
            code: "laboratory",
            display: "Laboratory",
          },
        ],
      },
    ],
    code: { text: row.name },
    subject: subjectRef(patient),
    ...(effective ? { effectiveDateTime: effective } : {}),
    valueString: row.value,
    interpretation: interpretation(row.flag),
  };
}

// Synthesize vital-sign Observations from the denormalized columns on the
// patient row. Returns an empty array when vitals are blank (e.g. a
// reception-registered patient with clinical fields stripped).
export function vitalObservations(patient: PatientRow): FhirResource[] {
  const effective = fhirDateTime(patient.vitalsTakenAt);
  const base = (idSuffix: string, text: string) => ({
    resourceType: "Observation" as const,
    id: `${patient.id}-vital-${idSuffix}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system: OBS_CATEGORY_SYSTEM,
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ],
    code: { text },
    subject: subjectRef(patient),
    ...(effective ? { effectiveDateTime: effective } : {}),
  });

  const out: FhirResource[] = [];

  if (patient.vitalsBp) {
    const bp = base("bp", "Blood pressure");
    const m = /^(\d+)\s*\/\s*(\d+)/.exec(patient.vitalsBp.trim());
    if (m) {
      out.push({
        ...bp,
        component: [
          {
            code: { text: "Systolic blood pressure" },
            valueQuantity: { value: Number(m[1]), unit: "mmHg" },
          },
          {
            code: { text: "Diastolic blood pressure" },
            valueQuantity: { value: Number(m[2]), unit: "mmHg" },
          },
        ],
      });
    } else {
      out.push({ ...bp, valueString: patient.vitalsBp });
    }
  }
  if (patient.vitalsHr)
    out.push({ ...base("hr", "Heart rate"), valueString: patient.vitalsHr });
  if (patient.vitalsTemp)
    out.push({
      ...base("temp", "Body temperature"),
      valueString: patient.vitalsTemp,
    });
  if (patient.vitalsSpo2)
    out.push({
      ...base("spo2", "Oxygen saturation"),
      valueString: patient.vitalsSpo2,
    });

  return out;
}

// --- AllergyIntolerance -----------------------------------------------------

export function allergyResource(
  row: AllergyRow,
  patient: PatientRow,
): FhirResource {
  return {
    resourceType: "AllergyIntolerance",
    id: row.id,
    clinicalStatus: {
      coding: [
        {
          system:
            "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
        },
      ],
    },
    code: { text: row.substance },
    patient: subjectRef(patient),
    criticality: row.severity === "severe" ? "high" : "low",
    reaction: [
      { manifestation: [{ text: row.reaction }], severity: row.severity },
    ],
  };
}

// --- Condition --------------------------------------------------------------

export function conditionResource(
  row: ProblemRow,
  patient: PatientRow,
): FhirResource {
  return {
    resourceType: "Condition",
    id: row.id,
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    code: { text: row.label },
    subject: subjectRef(patient),
    ...(row.since ? { onsetString: row.since } : {}),
  };
}

// --- MedicationRequest ------------------------------------------------------

export function medicationRequestResource(
  row: PrescriptionRow,
  patient: PatientRow,
): FhirResource {
  const status =
    row.status === "completed"
      ? "completed"
      : row.status === "expired"
        ? "stopped"
        : "active";
  const dosageText = [row.dose, row.frequency].filter(Boolean).join(" ").trim();
  return {
    resourceType: "MedicationRequest",
    id: row.id,
    status,
    intent: "order",
    medicationCodeableConcept: { text: row.medication },
    subject: subjectRef(patient),
    ...(row.prescribedAt ? { authoredOn: row.prescribedAt } : {}),
    requester: { display: row.prescriber },
    ...(dosageText ? { dosageInstruction: [{ text: dosageText }] } : {}),
  };
}

// --- Encounter --------------------------------------------------------------

function narrative(text: string): Record<string, unknown> {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return {
    status: "generated",
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${escaped}</div>`,
  };
}

export function encounterResource(
  row: EncounterRow,
  patient: PatientRow,
): FhirResource {
  const start = fhirDateTime(row.date);
  return {
    resourceType: "Encounter",
    id: row.id,
    ...(row.summary ? { text: narrative(row.summary) } : {}),
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    type: [{ text: row.type }],
    subject: subjectRef(patient),
    ...(start ? { period: { start } } : {}),
    participant: [{ individual: { display: row.provider } }],
  };
}

// --- Appointment ------------------------------------------------------------

export function appointmentResource(
  row: AppointmentRow,
  patient: PatientRow,
): FhirResource {
  const statusMap: Record<string, string> = {
    confirmed: "booked",
    "checked-in": "arrived",
    completed: "fulfilled",
    cancelled: "cancelled",
  };
  // Combine local date + time into an instant; omit when unparseable.
  const startDate =
    row.date && row.time ? new Date(`${row.date}T${row.time}:00`) : null;
  const start =
    startDate && !Number.isNaN(startDate.getTime())
      ? startDate.toISOString()
      : undefined;
  return {
    resourceType: "Appointment",
    id: row.id,
    status: statusMap[row.status] ?? "booked",
    description: row.type,
    ...(start ? { start } : {}),
    participant: [
      { actor: subjectRef(patient), status: "accepted" },
      ...(row.provider
        ? [{ actor: { display: row.provider }, status: "accepted" }]
        : []),
    ],
  };
}
