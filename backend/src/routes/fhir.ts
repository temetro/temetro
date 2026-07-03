import { createRequire } from "node:module";

import { Router } from "express";
import type { Request, Response } from "express";
import type { ParsedQs } from "qs";

import { env } from "../env.js";
import { requireFhirKey } from "../middleware/fhir-auth.js";
import { recordActivity } from "../services/activity.js";
import {
  paginate,
  parseCount,
  parseOffset,
  searchsetBundle,
} from "../services/fhir-server/bundle.js";
import { capabilityStatement } from "../services/fhir-server/capability.js";
import {
  FHIR_CONTENT_TYPE,
  operationOutcome,
  type IssueCode,
  type IssueSeverity,
} from "../services/fhir-server/outcome.js";
import * as q from "../services/fhir-server/queries.js";
import {
  allergyResource,
  appointmentResource,
  conditionResource,
  encounterResource,
  labObservation,
  medicationRequestResource,
  patientResource,
  vitalObservations,
  type FhirResource,
} from "../services/fhir-server/resources.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version?: string };
const VERSION = env.APP_VERSION ?? pkg.version ?? "0.0.0";

export const fhirRouter = Router();

// --- helpers ----------------------------------------------------------------

function baseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}/fhir`;
}

function sendResource(res: Response, resource: unknown): void {
  res.type(FHIR_CONTENT_TYPE).json(resource);
}

function sendOutcome(
  res: Response,
  status: number,
  severity: IssueSeverity,
  code: IssueCode,
  diagnostics: string,
): void {
  res
    .status(status)
    .type(FHIR_CONTENT_TYPE)
    .json(operationOutcome(severity, code, diagnostics));
}

function qstr(v: string | ParsedQs | (string | ParsedQs)[] | undefined): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim() || undefined;
  return undefined;
}

// Best-effort audit: every FHIR request is logged with the key name + result
// count, scoped to the org. Access to PHI over the API must leave a trail.
function audit(req: Request, resourceType: string, count: number): void {
  void recordActivity({
    orgId: req.organizationId!,
    actor: { name: `FHIR API · ${req.fhirKey?.name ?? "key"}` },
    action: `Read ${resourceType} via the FHIR API (${count} result${count === 1 ? "" : "s"})`,
    entityType: "patient",
  });
}

// Materialize a page from a full resource array + emit a searchset Bundle.
function respondSearch(
  req: Request,
  res: Response,
  resourceType: string,
  all: FhirResource[],
): void {
  const count = parseCount(qstr(req.query._count as never));
  const offset = parseOffset(qstr(req.query._offset as never));
  const { page, total } = paginate(all, count, offset);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "_count" || k === "_offset") continue;
    const s = qstr(v as never);
    if (s !== undefined) params.set(k, s);
  }
  audit(req, resourceType, total);
  sendResource(
    res,
    searchsetBundle({ baseUrl: baseUrl(req), resourceType, page, total, count, offset, params }),
  );
}

// Resolve the `patient` / `patient.identifier` search parameter to a patient row
// (org-scoped). Returns undefined when the param is absent or matches nobody.
async function patientFromQuery(req: Request) {
  const patientId = qstr(req.query.patient as never);
  const identifier = qstr(req.query["patient.identifier"] as never);
  if (!patientId && !identifier) return undefined;
  return q.resolvePatientRef(req.organizationId!, { patientId, identifier });
}

// --- CapabilityStatement (unauthenticated, per FHIR convention) -------------

fhirRouter.get("/metadata", (req, res) => {
  sendResource(res, capabilityStatement(baseUrl(req), VERSION));
});

// Everything below requires a valid per-clinic API key.
fhirRouter.use(requireFhirKey);

// --- Patient ----------------------------------------------------------------

fhirRouter.get("/Patient", async (req, res, next) => {
  try {
    const count = parseCount(qstr(req.query._count as never));
    const offset = parseOffset(qstr(req.query._offset as never));
    const { rows, total } = await q.searchPatients(req.organizationId!, {
      identifier: qstr(req.query.identifier as never),
      name: qstr(req.query.name as never),
      limit: count,
      offset,
    });
    const params = new URLSearchParams();
    if (qstr(req.query.identifier as never))
      params.set("identifier", qstr(req.query.identifier as never)!);
    if (qstr(req.query.name as never)) params.set("name", qstr(req.query.name as never)!);
    audit(req, "Patient", total);
    sendResource(
      res,
      searchsetBundle({
        baseUrl: baseUrl(req),
        resourceType: "Patient",
        page: rows.map(patientResource),
        total,
        count,
        offset,
        params,
      }),
    );
  } catch (err) {
    next(err);
  }
});

fhirRouter.get("/Patient/:id", async (req, res, next) => {
  try {
    const row = await q.patientById(req.organizationId!, String(req.params.id));
    if (!row) {
      sendOutcome(res, 404, "error", "not-found", "Patient not found.");
      return;
    }
    audit(req, "Patient", 1);
    sendResource(res, patientResource(row));
  } catch (err) {
    next(err);
  }
});

// --- Observation (labs + vitals) --------------------------------------------

fhirRouter.get("/Observation", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) {
      respondSearch(req, res, "Observation", []);
      return;
    }
    const category = qstr(req.query.category as never);
    const all: FhirResource[] = [];
    if (category !== "vital-signs") {
      const rows = await q.labsForPatient(patient.id);
      all.push(...rows.map((r) => labObservation(r, patient)));
    }
    if (category !== "laboratory") {
      all.push(...vitalObservations(patient));
    }
    respondSearch(req, res, "Observation", all);
  } catch (err) {
    next(err);
  }
});

// --- AllergyIntolerance -----------------------------------------------------

fhirRouter.get("/AllergyIntolerance", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) return respondSearch(req, res, "AllergyIntolerance", []);
    const rows = await q.allergiesForPatient(patient.id);
    respondSearch(req, res, "AllergyIntolerance", rows.map((r) => allergyResource(r, patient)));
  } catch (err) {
    next(err);
  }
});

// --- Condition --------------------------------------------------------------

fhirRouter.get("/Condition", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) return respondSearch(req, res, "Condition", []);
    const rows = await q.problemsForPatient(patient.id);
    respondSearch(req, res, "Condition", rows.map((r) => conditionResource(r, patient)));
  } catch (err) {
    next(err);
  }
});

// --- MedicationRequest ------------------------------------------------------

fhirRouter.get("/MedicationRequest", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) return respondSearch(req, res, "MedicationRequest", []);
    const rows = await q.prescriptionsForFile(req.organizationId!, patient.fileNumber);
    respondSearch(
      req,
      res,
      "MedicationRequest",
      rows.map((r) => medicationRequestResource(r, patient)),
    );
  } catch (err) {
    next(err);
  }
});

// --- Encounter --------------------------------------------------------------

fhirRouter.get("/Encounter", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) return respondSearch(req, res, "Encounter", []);
    const rows = await q.encountersForPatient(patient.id);
    respondSearch(req, res, "Encounter", rows.map((r) => encounterResource(r, patient)));
  } catch (err) {
    next(err);
  }
});

// --- Appointment ------------------------------------------------------------

fhirRouter.get("/Appointment", async (req, res, next) => {
  try {
    const patient = await patientFromQuery(req);
    if (!patient) return respondSearch(req, res, "Appointment", []);
    const rows = await q.appointmentsForFile(req.organizationId!, patient.fileNumber);
    respondSearch(req, res, "Appointment", rows.map((r) => appointmentResource(r, patient)));
  } catch (err) {
    next(err);
  }
});

// --- Unknown resource / path -> OperationOutcome ----------------------------

fhirRouter.use((req, res) => {
  sendOutcome(
    res,
    404,
    "error",
    "not-supported",
    `Unsupported FHIR path or resource: ${req.method} ${req.path}.`,
  );
});
