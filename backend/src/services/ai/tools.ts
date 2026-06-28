import { tool } from "ai";
import type { UIMessageStreamWriter } from "ai";
import { z } from "zod";

import { eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { organization } from "../../db/schema/auth.js";
import { appointmentInputSchema } from "../../lib/appointment-validation.js";
import { initialsFromName } from "../../lib/initials.js";
import { inventoryInputSchema } from "../../lib/inventory-validation.js";
import { invoiceInputSchema } from "../../lib/invoice-validation.js";
import { validatePatientImport } from "./import.js";
import { prescriptionInputSchema } from "../../lib/prescription-validation.js";
import { taskInputSchema } from "../../lib/task-validation.js";
import * as analytics from "../analytics.js";
import * as appointments from "../appointments.js";
import * as inventory from "../inventory.js";
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
  // The composer's "situation" mode (chat | analysis | graph). In graph mode
  // getPatient renders the record graph instead of the record cards.
  mode?: string;
  veil: Veil;
  writer: UIMessageStreamWriter;
};

// Shared schema for tools that take no real arguments. Google Gemini cannot
// emit a function call when a tool's parameter schema has no properties — it
// prints the call as `tool_code` text instead of invoking it (see the
// previewImport note below). One optional, ignored field keeps the schema
// non-empty so Gemini calls the tool; other providers ignore the extra field.
const emptyToolArgs = z.object({
  filter: z
    .string()
    .optional()
    .describe("Optional free-text filter (ignored — the full list is shown)"),
});

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
  const { orgId, demographicsOnly, scopeProviderId, viewer, mode, veil, writer } =
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

  // Register a citable source the model can reference inline. The title is the
  // REAL, clinician-facing label (streamed to the trusted UI, like the cards);
  // the returned id is PHI-free (`s1`, `s2`, …) so it survives Veil rehydration
  // when the model echoes it back as a [[src:id]] marker.
  let sourceSeq = 0;
  function addSource(title: string, kind: string): string {
    sourceSeq += 1;
    const id = `s${sourceSeq}`;
    writer.write({ type: "data-source", data: { id, title, kind } });
    return id;
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
        "Retrieve a patient's full record by file number (MRN). Displays it as record cards (or, in Graph mode, as the patient's record graph). Use when the clinician asks about a specific patient.",
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
        // Real data → clinician UI. In graph mode render the record graph; in
        // chat/analysis modes render the record cards. Redacted data → model.
        writer.write(
          mode === "graph"
            ? { type: "data-recordGraph", data: patient }
            : { type: "data-patientCard", data: patient },
        );
        const sourceId = addSource(
          `${patient.name} · MRN ${patient.fileNumber}`,
          "patient",
        );
        return {
          found: true as const,
          sourceId,
          patient: forModel(veil.redactPatient(patient)),
        };
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
        const sourceId = addSource(`Labs · ${patient.name}`, "lab");
        return {
          found: true as const,
          sourceId,
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
      inputSchema: emptyToolArgs,
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
        const sourceId = addSource("Appointments schedule", "appointments");
        return { count: rows.length, sourceId, appointments: rows };
      },
    }),

    listTasks: tool({
      description:
        "Display the care-team task list. Use when the clinician asks to see open tasks, to-dos, or what's assigned.",
      inputSchema: emptyToolArgs,
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
        const sourceId = addSource("Task list", "tasks");
        return { count: rows.length, sourceId, tasks: rows };
      },
    }),

    listPrescriptions: tool({
      description:
        "Display prescriptions for the clinic. Use when the clinician asks to see prescriptions or medications prescribed.",
      inputSchema: emptyToolArgs,
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
        const sourceId = addSource("Prescriptions", "prescriptions");
        return { count: rows.length, sourceId, prescriptions: rows };
      },
    }),

    // --- Propose an addition (dry-run, NEVER writes) ------------------------
    // Each propose tool validates the record and streams an approval card. The
    // clinician approves in the UI, which commits via the existing RBAC-gated
    // REST endpoint (POST /api/appointments | /tasks | /prescriptions). Nothing
    // is written here.

    proposeAppointment: tool({
      description:
        "Propose a new appointment for the clinician to approve. Does NOT save — it shows an approval card; the clinician confirms before anything is written. Prefer the patient's file number (MRN), which fills name/initials from the record. If the file number is unknown (e.g. parsing a schedule export), pass the patient's name instead; type/provider may be omitted and will be filled with placeholders for the clinician to edit.",
      inputSchema: z.object({
        fileNumber: z
          .string()
          .optional()
          .describe("Patient file number / MRN (may be a token); omit if unknown"),
        name: z
          .string()
          .optional()
          .describe("Patient name — use when no file number is known"),
        date: z.string().describe("Appointment date, YYYY-MM-DD"),
        time: z.string().describe("Appointment time, HH:mm (24h)"),
        type: z
          .string()
          .optional()
          .describe("Visit type, e.g. Follow-up, Consultation"),
        provider: z.string().optional().describe("Provider/clinician name"),
      }),
      execute: async ({ fileNumber, name, date, time, type, provider }) => {
        step(`Drafting appointment for ${fileNumber ?? name ?? "patient"}`);
        const patient = fileNumber ? await resolvePatient(fileNumber) : null;
        // A name (resolved or supplied) is the minimum needed to draft a row.
        const resolvedName = patient?.name ?? (name ? veil.rehydrate(name) : undefined);
        if (!resolvedName) {
          return { ok: false as const, reason: "patient_not_found" as const };
        }
        const candidate = {
          fileNumber: patient?.fileNumber ?? "",
          name: resolvedName,
          initials: patient?.initials ?? "",
          date,
          time,
          type: type ?? "",
          provider: provider ?? "",
          source: "ai" as const,
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
          source: "ai" as const,
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

    // --- Clinic-wide reads (aggregates / non-PHI — safe to return to model) ---

    getClinicInfo: tool({
      description:
        "Get the clinic's name and basic info. Use when the clinician asks about their clinic/organization (e.g. 'what's my clinic called?').",
      inputSchema: emptyToolArgs,
      execute: async () => {
        step("Loading clinic info");
        const [org] = await db
          .select({
            name: organization.name,
            slug: organization.slug,
            createdAt: organization.createdAt,
          })
          .from(organization)
          .where(eq(organization.id, orgId));
        const info = {
          name: org?.name ?? "",
          slug: org?.slug ?? null,
          createdAt: org?.createdAt ? org.createdAt.toISOString() : null,
        };
        writer.write({ type: "data-clinicCard", data: info });
        const sourceId = addSource(`Clinic · ${info.name}`, "clinic");
        return { ...info, sourceId };
      },
    }),

    getAnalytics: tool({
      description:
        "Retrieve the clinic's analytics AND earnings — patient/appointment/prescription/task counts plus money billed, paid, and outstanding (from invoices), with a by-month earnings trend. Use for KPIs, earnings, revenue, or performance questions.",
      inputSchema: emptyToolArgs,
      execute: async () => {
        step("Loading clinic analytics");
        const data = await analytics.getAnalytics(orgId);
        writer.write({ type: "data-analyticsCard", data });
        const sourceId = addSource("Clinic analytics", "analytics");
        return { ...data, sourceId }; // aggregates only, no PHI
      },
    }),

    listInventory: tool({
      description:
        "List the clinic's inventory (medications/supplies, stock levels, reorder thresholds). Use for stock, low-stock, or reorder questions.",
      inputSchema: emptyToolArgs,
      execute: async () => {
        step("Loading inventory");
        const items = await inventory.listInventory(orgId);
        writer.write({ type: "data-inventoryList", data: { items } });
        const sourceId = addSource("Inventory", "inventory");
        return {
          count: items.length,
          sourceId,
          items: items.map((i) => ({
            name: i.name,
            form: i.form,
            strength: i.strength,
            stock: i.stockQuantity,
            reorderThreshold: i.reorderThreshold,
          })),
        };
      },
    }),

    proposeInventory: tool({
      description:
        "Propose adding one or more items to the clinic's inventory (medications/supplies) for the clinician to approve — e.g. parse an uploaded stock or purchase list into stock items. Does NOT save; it shows an approval card the clinician confirms. Each item needs a name; form/strength/unit/stockQuantity/reorderThreshold/location/expiresAt (YYYY-MM-DD)/notes are optional. Use this for STOCKING inventory; use proposeInvoice instead when billing a patient for purchased items.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().describe("Item / medication name"),
              form: z
                .string()
                .optional()
                .describe("Dosage form, e.g. Tablet, Capsule, Syrup"),
              strength: z.string().optional().describe("e.g. 500mg"),
              unit: z
                .string()
                .optional()
                .describe("Dispensing unit, e.g. box, bottle"),
              stockQuantity: z
                .number()
                .optional()
                .describe("Units currently in stock"),
              reorderThreshold: z
                .number()
                .optional()
                .describe("Low-stock reorder level"),
              location: z.string().optional().describe("Storage location"),
              expiresAt: z
                .string()
                .nullish()
                .describe("Expiry date, YYYY-MM-DD"),
              notes: z.string().nullish(),
            }),
          )
          .describe("Inventory items to add (prices/quantities from the document)"),
      }),
      execute: async ({ items }) => {
        step(`Drafting ${items.length} inventory item(s)`);
        // Inventory is non-PHI — no Veil resolution needed.
        const validated: unknown[] = [];
        const issues: string[] = [];
        items.forEach((item, index) => {
          const parsed = inventoryInputSchema.safeParse(item);
          if (parsed.success) {
            validated.push(parsed.data);
          } else {
            issues.push(
              ...parsed.error.issues.map(
                (i) =>
                  `item ${index + 1} ${i.path.join(".") || "(root)"}: ${i.message}`,
              ),
            );
          }
        });
        writer.write({
          type: "data-actionPreview",
          data: {
            token: `inventory-${stepSeq}`,
            kind: "inventory" as const,
            record: { items: validated.length ? validated : items },
            issues,
          },
        });
        return {
          ok: issues.length === 0,
          count: validated.length,
          issues,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),

    proposeInvoice: tool({
      description:
        "Propose a new invoice for the clinician to approve — e.g. parse an uploaded list of purchased medications into billable line items. Does NOT save; it shows an approval card the clinician confirms. Provide the patient/client name (a file number if known) and line items {description, quantity, unitPrice}; prices come from the uploaded document.",
      inputSchema: z.object({
        name: z.string().describe("Patient/client name (may be a token)"),
        fileNumber: z
          .string()
          .optional()
          .describe("Patient file number / MRN if known"),
        lineItems: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            }),
          )
          .describe("Billed items, e.g. each purchased medication"),
        notes: z.string().nullish(),
      }),
      execute: async ({ name, fileNumber, lineItems, notes }) => {
        step(`Drafting invoice for ${fileNumber ?? name}`);
        const patient = fileNumber ? await resolvePatient(fileNumber) : null;
        const resolvedName = patient?.name ?? (name ? veil.rehydrate(name) : "");
        if (!resolvedName) {
          return { ok: false as const, reason: "patient_not_found" as const };
        }
        const candidate = {
          fileNumber: patient?.fileNumber ?? "",
          name: resolvedName,
          initials: patient?.initials ?? initialsFromName(resolvedName),
          lineItems,
          notes: notes ?? null,
          source: "ai" as const,
        };
        const parsed = invoiceInputSchema.safeParse(candidate);
        const issues = parsed.success
          ? []
          : parsed.error.issues.map(
              (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
            );
        writer.write({
          type: "data-actionPreview",
          data: {
            token: `invoice-${stepSeq}`,
            kind: "invoice" as const,
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
      // A concrete object schema (not z.unknown()): Google Gemini can only emit a
      // real function call when the tool's parameters have a defined JSON schema.
      // An array-of-unknown serializes to an empty schema, which makes Gemini
      // print the call as `tool_code` text instead of invoking it. Validation
      // stays lenient — execute() re-parses each record with patientInputSchema,
      // which coerces gender words, bare-string lists, etc.
      inputSchema: z.object({
        records: z
          .array(
            z.object({
              fileNumber: z
                .string()
                .optional()
                .describe(
                  "File number / MRN; digits only (leave blank to auto-generate)",
                ),
              name: z.string().describe("Patient full name"),
              age: z.number().optional().describe("Age in years"),
              sex: z
                .string()
                .optional()
                .describe("Sex — accepts Male/Female or M/F"),
              status: z
                .string()
                .optional()
                .describe("active, inpatient, or discharged"),
              pcp: z.string().optional().describe("Primary care provider name"),
              alerts: z
                .array(z.string())
                .optional()
                .describe("Free-text clinical alerts"),
              allergies: z
                .array(
                  z.object({
                    substance: z.string().describe("Allergen, e.g. Penicillin"),
                    reaction: z.string().optional(),
                    severity: z
                      .string()
                      .optional()
                      .describe("mild, moderate, or severe"),
                  }),
                )
                .optional(),
              medications: z
                .array(
                  z.object({
                    name: z.string(),
                    dose: z.string().optional(),
                    frequency: z.string().optional(),
                  }),
                )
                .optional(),
              problems: z
                .array(
                  z.object({
                    label: z.string().describe("Problem / diagnosis"),
                    since: z.string().optional(),
                  }),
                )
                .optional(),
              labs: z
                .array(
                  z.object({
                    name: z.string(),
                    value: z.string(),
                    flag: z
                      .string()
                      .optional()
                      .describe("normal, high, low, or critical"),
                    takenAt: z
                      .string()
                      .optional()
                      .describe("Date, YYYY-MM-DD"),
                  }),
                )
                .optional(),
              encounters: z
                .array(
                  z.object({
                    date: z
                      .string()
                      .optional()
                      .describe("Visit date, YYYY-MM-DD"),
                    type: z
                      .string()
                      .optional()
                      .describe("Visit type / department"),
                    provider: z.string().optional(),
                    summary: z
                      .string()
                      .optional()
                      .describe("Diagnosis / treatment / notes combined"),
                  }),
                )
                .optional(),
            }),
          )
          .describe("Patient records parsed from the upload, mapped to temetro's shape"),
      }),
      execute: async ({ records }) => {
        step(`Validating ${records.length} record(s)`);
        const { valid, invalid, total } = validatePatientImport(records);
        // Hand the validated set + the raw records to the UI for an approval
        // card. The client can edit any record, re-validate, and posts the valid
        // set back to /api/ai/import on approval. `records` carries the originals
        // so invalid rows are editable.
        writer.write({
          type: "data-importPreview",
          data: { records, valid, invalid, total },
        });
        step(`${valid.length} ready, ${invalid.length} skipped`);
        return {
          total,
          validCount: valid.length,
          invalidCount: invalid.length,
          invalid,
          note: "Preview only — awaiting clinician approval before any write.",
        };
      },
    }),
  };
}
