import { readFile } from "node:fs/promises";

import { generateText } from "ai";
import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import { isReceptionOnly, providerScope } from "../lib/role-scope.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { getAiSettings } from "../services/ai/config.js";
import { aiAllowedFor, getPolicy } from "../services/ai/policy.js";
import { resolveModel } from "../services/ai/provider.js";
import { transcribeAudio } from "../services/ai/transcribe.js";
import { createVeil } from "../services/ai/veil.js";
import { absolutePath, getAttachmentRow } from "../services/attachments.js";
import { appendEncounter, getPatient } from "../services/patients.js";
import type { Encounter } from "../types/patient.js";

export const scribeRouter = Router();

// The ambient scribe drafts and saves a clinical encounter note, so it needs
// full clinical write access — never reception (demographics only).
scribeRouter.use(
  requireAuth,
  requireOrg,
  requirePermission({ patient: ["write"] }),
);

// Guard shared by every scribe route: the clinic AI kill-switch must allow this
// member, and reception (demographics-only) can never draft clinical notes.
async function ensureScribeAllowed(req: {
  organizationId?: string;
  memberRole?: string;
}): Promise<void> {
  if (isReceptionOnly(req.memberRole)) {
    throw new HttpError(403, "The visit scribe is not available for your role.");
  }
  const policy = await getPolicy(req.organizationId!);
  if (!aiAllowedFor(policy, req.memberRole)) {
    throw new HttpError(403, "The AI assistant is disabled for your account.");
  }
}

const transcribeSchema = z.object({
  attachmentId: z.string().trim().min(1),
});

// POST /api/scribe/transcribe — turn a stored audio attachment into a raw
// transcript via the user's speech provider (OpenAI/Gemini). The audio does NOT
// pass through Veil or the chat loop.
scribeRouter.post("/transcribe", async (req, res, next) => {
  try {
    await ensureScribeAllowed(req);
    const { attachmentId } = transcribeSchema.parse(req.body);
    const row = await getAttachmentRow(req.organizationId!, attachmentId);
    if (!row) throw new HttpError(404, "Recording not found.");
    if (!row.mimeType.startsWith("audio/")) {
      throw new HttpError(400, "That attachment is not an audio recording.");
    }

    const settings = await getAiSettings(req.user!.id);
    const buffer = await readFile(absolutePath(row.storagePath));
    const { transcript, provider } = await transcribeAudio(settings, {
      buffer,
      mimeType: row.mimeType,
      filename: row.filename,
    });

    void recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: `Transcribed a visit recording (${provider})`,
      entityType: "patient",
      patientFileNumber: row.fileNumber,
    });

    res.json({ transcript });
  } catch (err) {
    next(err);
  }
});

const draftSchema = z.object({
  fileNumber: z.string().trim().min(1),
  transcript: z.string().trim().min(1).max(100_000),
  visitType: z.string().trim().max(120).optional(),
  date: z.string().trim().max(40).optional(),
});

// Strip ```json fences and parse; returns null if the text isn't JSON.
function parseDraftJson(text: string): { type?: string; summary?: string } | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

const DRAFT_SYSTEM = [
  "You are a clinical scribe. From a visit transcript, write a concise, structured",
  "encounter note in SOAP format (Subjective, Objective, Assessment, Plan).",
  "Rules:",
  "- Use ONLY what the transcript supports. Never invent vitals, doses, or findings.",
  "- If a SOAP section has nothing to report, write \"Not discussed.\" under it.",
  "- Identifiers may appear as tokens like [PATIENT_1] or [PROVIDER_1]; keep them",
  "  verbatim — do not guess real names.",
  "Respond with a JSON object ONLY (no prose, no code fences):",
  '{ "type": "<short visit type, e.g. Follow-up / New patient / Telehealth>",',
  '  "summary": "<the SOAP note as markdown with **Subjective** / **Objective** /',
  '  **Assessment** / **Plan** headings>" }',
].join("\n");

// POST /api/scribe/draft — draft an encounter note from a transcript. The
// transcript + patient context are Veil-redacted before any external call and
// the output is rehydrated. Nothing is written — the clinician reviews and
// approves via POST /save (the same write-approval gate as the chat agent).
scribeRouter.post("/draft", async (req, res, next) => {
  try {
    await ensureScribeAllowed(req);
    const { fileNumber, transcript, visitType, date } = draftSchema.parse(
      req.body,
    );

    const patient = await getPatient(
      req.organizationId!,
      fileNumber,
      false,
      providerScope(req.memberRole, req.user!.id),
    );
    if (!patient) throw new HttpError(404, "Patient not found.");

    const settings = await getAiSettings(req.user!.id);
    const resolved = resolveModel(settings, settings.defaultModel);
    const veil = createVeil(settings.veilLevel, resolved.isExternal);

    // Seed Veil's token maps with this patient's identifiers, then redact the
    // free-text transcript against them before it leaves the clinic.
    const redactedPatient = veil.redactPatient(patient);
    const redactedTranscript = veil.redactText(transcript);

    const context = [
      `Patient: ${redactedPatient.name} (MRN ${redactedPatient.fileNumber}), ${patient.age}y ${patient.sex}.`,
      patient.problems.length
        ? `Known problems: ${patient.problems.map((p) => p.label).join(", ")}.`
        : "",
      patient.medications.length
        ? `Current medications: ${patient.medications
            .map((m) => `${m.name} ${m.dose}`)
            .join(", ")}.`
        : "",
      visitType ? `Visit type hint: ${visitType}.` : "",
      "",
      "Transcript:",
      redactedTranscript,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await generateText({
      model: resolved.model,
      system: DRAFT_SYSTEM,
      prompt: context,
    });

    const parsed = parseDraftJson(result.text);
    const summary = veil.rehydrate(
      (parsed?.summary ?? result.text ?? "").trim(),
    );
    const type = (parsed?.type ?? visitType ?? "Visit").trim() || "Visit";

    const draft: Encounter = {
      date: date || new Date().toISOString().slice(0, 10),
      type,
      // The responsible clinician is the signed-in user, not the model's guess.
      provider: req.user!.name ?? "",
      summary,
    };

    res.json({
      draft,
      veil: {
        active: veil.active,
        level: veil.level,
        classes: veil.usedClasses(),
        provider: resolved.providerLabel,
      },
    });
  } catch (err) {
    next(err);
  }
});

const saveSchema = z.object({
  fileNumber: z.string().trim().min(1),
  encounter: z.object({
    date: z.string().trim().min(1),
    type: z.string().trim().min(1),
    provider: z.string().trim().default(""),
    summary: z.string().trim().min(1),
  }),
});

// POST /api/scribe/save — the approval step: append the reviewed encounter note
// to the patient record. Re-validates server-side and audits like any add.
scribeRouter.post("/save", async (req, res, next) => {
  try {
    await ensureScribeAllowed(req);
    const { fileNumber, encounter } = saveSchema.parse(req.body);
    const updated = await appendEncounter(
      req.organizationId!,
      fileNumber,
      encounter,
    );
    if (!updated) throw new HttpError(404, "Patient not found.");

    void recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: `Added a scribe visit note for ${updated.name}`,
      entityType: "patient",
      entityId: updated.fileNumber,
      patientName: updated.name,
      patientFileNumber: updated.fileNumber,
    });

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});
