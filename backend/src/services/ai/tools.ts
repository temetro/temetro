import { tool } from "ai";
import type { UIMessageStreamWriter } from "ai";
import { z } from "zod";

import { appointmentInputSchema } from "../../lib/appointment-validation.js";
import { patientInputSchema } from "../../lib/patient-validation.js";
import { prescriptionInputSchema } from "../../lib/prescription-validation.js";
import { taskInputSchema } from "../../lib/task-validation.js";
import * as appointments from "../appointments.js";
import * as patients from "../patients.js";
import * as prescriptions from "../prescriptions.js";
import * as tasks from "../tasks.js";
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
  // The signed-in clinician — needed to scope task visibility (and to stamp the
  // creator when an add is committed via the REST endpoints on approval).
  viewer: { userId: string; userName: string; memberRole: string };
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
  const { orgId, demographicsOnly, scopeProviderId, viewer, veil, writer } =
    ctx;

  // Emit a Chain-of-Thought step to the UI as the agent works. Steps stream live
  // (writer.write flushes immediately) even on the non-streamed external+Veil
  // path, so the clinician always sees progress. Labels must be Veil-safe — use
  // the tokenized identifiers the model passed, never resolved real names.
  let stepSeq = 0;
  function step(label: string) {
    stepSeq += 1;
    writer.write({
      type: "data-step",
      data: { id: `step-${stepSeq}`, label, status: "complete" as const },
    });
  }

  // Resolve a possibly-tokenized file number to the real patient record, so an
  // add proposal carries real name/initials into the approval card (the model
  // only ever saw Veil tokens). Returns null when the patient isn't found / is
  // out of scope.
  async function resolvePatient(fileNumber: string): Promise<Patient | null> {
    const real = veil.resolveFileNumber(fileNumber);
    return patients.getPatient(orgId, real, demographicsOnly, scopeProviderId);
  }

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
        step(`Looking up patient ${fileNumber}`);
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
        step(`Reading labs for patient ${fileNumber}`);
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
        step(`Searching patients for "${query}"`);
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
        step(`Found ${matches.length} match(es)`);
        return { count: matches.length, matches };
      },
    }),

    // --- Display the clinic's schedule / work queues (read-only) -------------

    listAppointments: tool({
      description:
        "Display the clinic's appointments. Use when the clinician asks to see the schedule, upcoming visits, or today's appointments.",
      inputSchema: z.object({}),
      execute: async () => {
        step("Loading appointments");
        const all = await appointments.listAppointments(orgId);
        writer.write({ type: "data-appointmentList", data: { appointments: all } });
        // Model-facing rows are Veil-safe: redact patient names to tokens.
        const rows = all.map((a) => ({
          date: a.date,
          time: a.time,
          type: a.type,
          provider: a.provider,
          status: a.status,
          patient: veil.active ? "[PATIENT]" : a.name,
        }));
        return { count: rows.length, appointments: rows };
      },
    }),

    listTasks: tool({
      description:
        "Display the care-team task list. Use when the clinician asks to see open tasks, to-dos, or what's assigned.",
      inputSchema: z.object({}),
      execute: async () => {
        step("Loading tasks");
        const all = await tasks.listTasks(orgId, {
          userId: viewer.userId,
          role: viewer.memberRole,
        });
        writer.write({ type: "data-taskList", data: { tasks: all } });
        const rows = all.map((tk) => ({
          title: tk.title,
          assignee: tk.assignee,
          due: tk.due,
          priority: tk.priority,
          done: tk.done,
        }));
        return { count: rows.length, tasks: rows };
      },
    }),

    listPrescriptions: tool({
      description:
        "Display prescriptions for the clinic. Use when the clinician asks to see prescriptions or medications prescribed.",
      inputSchema: z.object({}),
      execute: async () => {
        if (demographicsOnly) {
          return { found: false as const, reason: "not_authorized" as const };
        }
        step("Loading prescriptions");
        const all = await prescriptions.listPrescriptions(orgId);
        writer.write({
          type: "data-prescriptionList",
          data: { prescriptions: all },
        });
        const rows = all.map((rx) => ({
          medication: rx.medication,
          dose: rx.dose,
          frequency: rx.frequency,
          status: rx.status,
          prescribedAt: rx.prescribedAt,
          patient: veil.active ? "[PATIENT]" : rx.name,
        }));
        return { count: rows.length, prescriptions: rows };
      },
    }),

    // --- Propose an addition (dry-run, NEVER writes) ------------------------
    // Each propose tool validates the record and streams an approval card. The
    // clinician approves in the UI, which commits via the existing RBAC-gated
    // REST endpoint (POST /api/appointments | /tasks | /prescriptions). Nothing
    // is written here.

    proposeAppointment: tool({
      description:
        "Propose a new appointment for the clinician to approve. Does NOT save — it shows an approval card; the clinician confirms before anything is written. Provide the patient's file number (MRN); name/initials are filled from the record.",
      inputSchema: z.object({
        fileNumber: z.string().describe("Patient file number / MRN (may be a token)"),
        date: z.string().describe("Appointment date, YYYY-MM-DD"),
        time: z.string().describe("Appointment time, HH:mm (24h)"),
        type: z.string().describe("Visit type, e.g. Follow-up, Consultation"),
        provider: z.string().describe("Provider/clinician name"),
      }),
      execute: async ({ fileNumber, date, time, type, provider }) => {
        step(`Drafting appointment for patient ${fileNumber}`);
        const patient = await resolvePatient(fileNumber);
        if (!patient) {
          return { ok: false as const, reason: "patient_not_found" as const };
        }
        const candidate = {
          fileNumber: patient.fileNumber,
          name: patient.name,
          initials: patient.initials,
          date,
          time,
          type,
          provider,
        };
        const parsed = appointmentInputSchema.safeParse(candidate);
        const issues = parsed.success
          ? []
          : parsed.error.issues.map(
              (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
            );
        writer.write({
          type: "data-actionPreview",
          data: {
            token: `appt-${stepSeq}`,
            kind: "appointment" as const,
            // Real, ready-to-commit values for the approval card.
            record: parsed.success ? parsed.data : candidate,
            issues,
          },
        });
        return {
          ok: parsed.success,
          issues,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),

    proposeTask: tool({
      description:
        "Propose a new care-team task for the clinician to approve. Does NOT save — it shows an approval card the clinician confirms before anything is written.",
      inputSchema: z.object({
        title: z.string().describe("What needs doing"),
        assignee: z.string().optional().describe("Who it's assigned to (free text)"),
        assigneeRole: z
          .enum(["admin", "doctor", "reception", "pharmacy", "lab"])
          .nullish()
          .describe("Department the task belongs to; omit for a personal task"),
        due: z.string().optional().describe("Due date / timeframe (free text)"),
        priority: z.enum(["high", "medium", "low"]).optional(),
        patient: z.string().nullish().describe("Related patient (free text)"),
        notes: z.string().nullish(),
      }),
      execute: async (input) => {
        step(`Drafting task "${input.title}"`);
        // Patient free-text may contain Veil tokens — rehydrate for the card.
        const candidate = {
          ...input,
          patient: input.patient ? veil.rehydrate(input.patient) : input.patient,
        };
        const parsed = taskInputSchema.safeParse(candidate);
        const issues = parsed.success
          ? []
          : parsed.error.issues.map(
              (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
            );
        writer.write({
          type: "data-actionPreview",
          data: {
            token: `task-${stepSeq}`,
            kind: "task" as const,
            record: parsed.success ? parsed.data : candidate,
            issues,
          },
        });
        return {
          ok: parsed.success,
          issues,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),

    proposePrescription: tool({
      description:
        "Propose a new prescription for the clinician to approve. Does NOT save — it shows an approval card the clinician confirms before anything is written. Provide the patient's file number (MRN).",
      inputSchema: z.object({
        fileNumber: z.string().describe("Patient file number / MRN (may be a token)"),
        medication: z.string().describe("Medication name"),
        dose: z.string().optional().describe("Dose, e.g. 500mg"),
        frequency: z.string().describe("Frequency, e.g. twice daily"),
        duration: z.string().nullish().describe("Duration, e.g. 7 days"),
        notes: z.string().nullish(),
      }),
      execute: async ({ fileNumber, medication, dose, frequency, duration, notes }) => {
        if (demographicsOnly) {
          return { ok: false as const, reason: "not_authorized" as const };
        }
        step(`Drafting prescription for patient ${fileNumber}`);
        const patient = await resolvePatient(fileNumber);
        if (!patient) {
          return { ok: false as const, reason: "patient_not_found" as const };
        }
        const candidate = {
          fileNumber: patient.fileNumber,
          name: patient.name,
          initials: patient.initials,
          medication,
          dose: dose ?? "",
          frequency,
          duration: duration ?? null,
          notes: notes ?? null,
        };
        const parsed = prescriptionInputSchema.safeParse(candidate);
        const issues = parsed.success
          ? []
          : parsed.error.issues.map(
              (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
            );
        writer.write({
          type: "data-actionPreview",
          data: {
            token: `rx-${stepSeq}`,
            kind: "prescription" as const,
            record: parsed.success ? parsed.data : candidate,
            issues,
          },
        });
        return {
          ok: parsed.success,
          issues,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),

    // Migration: validate parsed records WITHOUT writing. The model parses an
    // uploaded export into our patient shape and calls this; the result drives
    // an approval card. Nothing is inserted until the clinician approves and the
    // client posts to POST /api/ai/import (which re-validates + writes).
    previewImport: tool({
      description:
        "Validate patient records parsed from an uploaded database export, as a dry run. Does NOT save anything. Call this when the clinician wants to import/migrate an existing patient database OR add a single patient; parse the file into our patient shape first. The clinician must approve before any data is written.",
      inputSchema: z.object({
        records: z
          .array(z.unknown())
          .describe(
            "Patient records mapped to temetro's shape (fileNumber, name, age, sex, vitals, labs, medications, problems, allergies, encounters).",
          ),
      }),
      execute: async ({ records }) => {
        step(`Validating ${records.length} record(s)`);
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
        step(`${valid.length} ready, ${invalid.length} skipped`);
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
