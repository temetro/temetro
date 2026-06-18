import { HttpError } from "../../lib/http-error.js";
import type { Lab, LabFlag } from "../../types/patient.js";
import { appendLabs, getPatient } from "../patients.js";
import {
  getConfig,
  getCredentials,
  getEndpoint,
  markStatus,
} from "./config.js";

// A real HL7/FHIR R4 lab integration. The clinic configures a FHIR base URL
// (e.g. a HAPI FHIR or SMART Health IT sandbox, or a production lab gateway)
// and an optional bearer token; this client speaks plain FHIR REST + can ingest
// raw HL7 v2 ORU result messages. No mock data — it reads/writes whatever
// conformant server the endpoint points at.

type FhirCredentials = { token?: string };

function bearer(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FhirCredentials;
    return parsed.token ?? null;
  } catch {
    // Stored as a bare token string.
    return raw.trim() || null;
  }
}

function headers(token: string | null): Record<string, string> {
  return {
    Accept: "application/fhir+json",
    "Content-Type": "application/fhir+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

// FHIR interpretation code (v3 ObservationInterpretation) → our LabFlag.
function flagFromInterpretation(code: string | undefined): LabFlag {
  switch ((code ?? "").toUpperCase()) {
    case "H":
    case "HU":
      return "high";
    case "L":
    case "LU":
      return "low";
    case "HH":
    case "LL":
    case "AA":
    case "PANIC":
      return "critical";
    default:
      return "normal";
  }
}

type FhirObservation = {
  resourceType: "Observation";
  code?: { text?: string; coding?: { display?: string; code?: string }[] };
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  effectiveDateTime?: string;
  issued?: string;
  interpretation?: { coding?: { code?: string }[] }[];
};

type FhirBundle = {
  resourceType: "Bundle";
  entry?: { resource?: FhirObservation }[];
};

function observationToLab(obs: FhirObservation): Lab | null {
  const name =
    obs.code?.text ??
    obs.code?.coding?.[0]?.display ??
    obs.code?.coding?.[0]?.code;
  if (!name) return null;
  const value =
    obs.valueQuantity?.value != null
      ? `${obs.valueQuantity.value}${
          obs.valueQuantity.unit ? ` ${obs.valueQuantity.unit}` : ""
        }`
      : obs.valueString;
  if (!value) return null;
  const when = obs.effectiveDateTime ?? obs.issued;
  const takenAt = when
    ? new Date(when).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
  return {
    name,
    value,
    flag: flagFromInterpretation(obs.interpretation?.[0]?.coding?.[0]?.code),
    takenAt,
  };
}

// Probe the server's capability statement. Returns a short status line.
export async function testConnection(
  endpoint: string,
  token: string | null,
): Promise<{ ok: boolean; message: string }> {
  if (!endpoint) return { ok: false, message: "No endpoint configured." };
  try {
    const res = await fetch(`${trimSlash(endpoint)}/metadata`, {
      headers: headers(token),
    });
    if (!res.ok) {
      return { ok: false, message: `Server returned ${res.status}.` };
    }
    const body = (await res.json().catch(() => null)) as {
      resourceType?: string;
      fhirVersion?: string;
    } | null;
    if (body?.resourceType !== "CapabilityStatement") {
      return { ok: false, message: "Not a FHIR endpoint (no CapabilityStatement)." };
    }
    return {
      ok: true,
      message: `Connected to FHIR ${body.fhirVersion ?? "server"}.`,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

// Pull a patient's laboratory Observations from the configured FHIR server and
// append them to the local record. Matches the patient by their MRN
// (file number) via `patient.identifier`.
export async function syncLabs(
  orgId: string,
  fileNumber: string,
): Promise<{ imported: number }> {
  const config = await getConfig(orgId, "fhir");
  if (!config.enabled) {
    throw new HttpError(400, "The FHIR integration is not enabled.");
  }
  const endpoint = config.endpoint;
  if (!endpoint) {
    throw new HttpError(400, "No FHIR endpoint configured.");
  }
  const patient = await getPatient(orgId, fileNumber);
  if (!patient) throw new HttpError(404, "Patient not found.");
  const token = bearer(await getCredentials(orgId, "fhir"));

  const url =
    `${trimSlash(endpoint)}/Observation` +
    `?patient.identifier=${encodeURIComponent(fileNumber)}` +
    `&category=laboratory&_sort=-date&_count=50`;

  try {
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) {
      await markStatus(orgId, "fhir", "error");
      throw new HttpError(502, `FHIR server returned ${res.status}.`);
    }
    const bundle = (await res.json()) as FhirBundle;
    const labs = (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FhirObservation => r?.resourceType === "Observation")
      .map(observationToLab)
      .filter((l): l is Lab => l !== null);

    if (labs.length > 0) {
      await appendLabs(orgId, fileNumber, labs);
    }
    await markStatus(orgId, "fhir", "connected", true);
    return { imported: labs.length };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    await markStatus(orgId, "fhir", "error");
    throw new HttpError(502, `FHIR sync failed: ${(err as Error).message}`);
  }
}

// Parse a raw HL7 v2 ORU^R01 result message into lab entries (one per OBX
// segment). Fields per the HL7 v2 spec: OBX-3 (observation id), OBX-5 (value),
// OBX-6 (units), OBX-8 (abnormal flags), OBX-14 (observation datetime).
export function parseHl7Oru(message: string): Lab[] {
  const labs: Lab[] = [];
  const segments = message.split(/\r\n|\r|\n/).filter(Boolean);
  for (const segment of segments) {
    const fields = segment.split("|");
    if (fields[0] !== "OBX") continue;
    const obsId = (fields[3] ?? "").split("^");
    const name = obsId[1] || obsId[0] || "";
    const rawValue = fields[5] ?? "";
    if (!name || !rawValue) continue;
    const units = fields[6] ?? "";
    const abnormal = (fields[8] ?? "").toUpperCase();
    const flag: LabFlag =
      abnormal === "H"
        ? "high"
        : abnormal === "L"
          ? "low"
          : abnormal === "HH" || abnormal === "LL" || abnormal === "AA"
            ? "critical"
            : "normal";
    const dt = fields[14] ?? "";
    // HL7 datetime is YYYYMMDD[HHMM]; format just the date portion.
    const takenAt = /^\d{8}/.test(dt)
      ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`
      : new Date().toISOString().slice(0, 10);
    labs.push({
      name,
      value: units ? `${rawValue} ${units}` : rawValue,
      flag,
      takenAt,
    });
  }
  return labs;
}

// Ingest a raw HL7 v2 ORU message: parse it and append the results to the
// patient's record. Used by the message-based intake endpoint.
export async function ingestHl7(
  orgId: string,
  fileNumber: string,
  message: string,
): Promise<{ imported: number }> {
  const labs = parseHl7Oru(message);
  if (labs.length === 0) {
    throw new HttpError(400, "No OBX result segments found in the message.");
  }
  const updated = await appendLabs(orgId, fileNumber, labs);
  if (!updated) throw new HttpError(404, "Patient not found.");
  await markStatus(orgId, "fhir", "connected", true);
  return { imported: labs.length };
}

export { getEndpoint };
