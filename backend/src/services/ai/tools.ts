import { tool } from "ai";
import type { UIMessageStreamWriter } from "ai";
import { z } from "zod";

import { patientInputSchema } from "../../lib/patient-validation.js";
import * as patients from "../patients.js";
import type { Patient } from "../../types/patient.js";
import type { Veil } from "./veil.js";

// Context every tool closes over: the caller's clinic + role-derived scoping,
// the Veil safeguard, and the UI stream writer used to push REAL (un-redacted)
// record data to the trusted clinician's screen as custom data parts, while the
// value returned to the model stays Veil-redacted on external providers.
export type ToolContext = {
  orgId: string;
  demographicsOnly: boolean;
  scopeProviderId?: string;
  veil: Veil;
  writer: UIMessageStreamWriter;
};

// Compact, model-facing projection of a patient (Veil-redacted upstream). Keeps
// clinical signal, drops bulky arrays the model rarely needs verbatim.
function forModel(p: Patient) {
  return {
    fileNumber: p.fileNumber,
    name: p.name,
    age: p.age,
    sex: p.sex,
    status: p.status,
    pcp: p.pcp,
    allergies: p.allergies,
    alerts: p.alerts,
    problems: p.problems,
    medications: p.medications,
    vitals: p.vitals,
    labs: p.labs,
  };
}

export function createChatTools(ctx: ToolContext) {
  const { orgId, demographicsOnly, scopeProviderId, veil, writer } = ctx;

  return {
    // Look up one patient by file number (MRN) and show their record cards.
    getPatient: tool({
      description:
        "Retrieve a patient's full record by file number (MRN) and display it as record cards. Use when the clinician asks about a specific patient.",
      inputSchema: z.object({
        fileNumber: z
          .string()
          .describe("The patient's file number / MRN, e.g. 10293"),
      }),
      execute: async ({ fileNumber }) => {
        const real = veil.resolveFileNumber(fileNumber);
        const patient = await patients.getPatient(
          orgId,
          real,
          demographicsOnly,
          scopeProviderId,
        );
        if (!patient) return { found: false as const, fileNumber };
        // Real data → clinician UI (cards). Redacted data → model.
        writer.write({ type: "data-patientCard", data: patient });
        return { found: true as const, patient: forModel(veil.redactPatient(patient)) };
      },
    }),

    // Pull a patient's labs (with high/low flags + trend) and chart them.
    getPatientLabs: tool({
      description:
        "Retrieve a patient's lab results and trend for charting. Use when the clinician asks about labs, results, or values over time.",
      inputSchema: z.object({
        fileNumber: z.string().describe("The patient's file number / MRN"),
      }),
      execute: async ({ fileNumber }) => {
        const real = veil.resolveFileNumber(fileNumber);
        const patient = await patients.getPatient(
          orgId,
          real,
          demographicsOnly,
          scopeProviderId,
        );
        if (!patient) return { found: false as const, fileNumber };
        if (demographicsOnly) {
          return { found: false as const, reason: "not_authorized" as const };
        }
        writer.write({
          type: "data-labCard",
          data: {
            fileNumber: patient.fileNumber,
            name: patient.name,
            labs: patient.labs,
            labTrend: patient.labTrend,
          },
        });
        const redacted = veil.redactPatient(patient);
        return {
          found: true as const,
          name: redacted.name,
          labs: patient.labs,
          labTrend: patient.labTrend,
        };
      },
    }),

    // Search the clinic's patients by name or file number.
    searchPatients: tool({
      description:
        "Search the clinic's patients by name fragment. Returns matches with file numbers so you can then call getPatient.",
      inputSchema: z.object({
        query: z.string().describe("Name or file-number fragment to match"),
      }),
      execute: async ({ query }) => {
        const all = await patients.listPatients(
          orgId,
          demographicsOnly,
          scopeProviderId,
        );
        const q = query.trim().toLowerCase();
        const matches = all
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.fileNumber.toLowerCase().includes(q),
          )
          .slice(0, 10)
          .map((p) => {
            const r = veil.redactPatient(p);
            return { fileNumber: r.fileNumber, name: r.name, status: p.status };
          });
        return { count: matches.length, matches };
      },
    }),

    // Migration: validate parsed records WITHOUT writing. The model parses an
    // uploaded export into our patient shape and calls this; the result drives
    // an approval card. Nothing is inserted until the clinician approves and the
    // client posts to POST /api/ai/import (which re-validates + writes).
    previewImport: tool({
      description:
        "Validate patient records parsed from an uploaded database export, as a dry run. Does NOT save anything. Call this when the clinician wants to import/migrate an existing patient database; parse the file into our patient shape first. The clinician must approve before any data is written.",
      inputSchema: z.object({
        records: z
          .array(z.unknown())
          .describe(
            "Patient records mapped to temetro's shape (fileNumber, name, age, sex, vitals, labs, medications, problems, allergies, encounters).",
          ),
      }),
      execute: async ({ records }) => {
        const valid: unknown[] = [];
        const invalid: { index: number; errors: string[] }[] = [];
        records.forEach((rec, index) => {
          const parsed = patientInputSchema.safeParse(rec);
          if (parsed.success) {
            valid.push(parsed.data);
          } else {
            invalid.push({
              index,
              errors: parsed.error.issues.map(
                (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
              ),
            });
          }
        });
        // Hand the validated, ready-to-commit set to the UI for an approval
        // card. The client posts these back to /api/ai/import on approval.
        writer.write({
          type: "data-importPreview",
          data: { valid, invalid, total: records.length },
        });
        return {
          total: records.length,
          validCount: valid.length,
          invalidCount: invalid.length,
          invalid,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),
  };
}
