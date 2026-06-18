import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import {
  aiConfigInputSchema,
  aiTestInputSchema,
} from "../lib/ai-validation.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import { isReceptionOnly } from "../lib/role-scope.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import {
  getAiSettings,
  saveAiConfig,
  toAiConfig,
} from "../services/ai/config.js";
import { validatePatientImport } from "../services/ai/import.js";
import { getPolicy, savePolicy } from "../services/ai/policy.js";
import * as patients from "../services/patients.js";

export const aiRouter = Router();

// --- Clinic-wide AI policy (admin-controlled kill-switch) -------------------
// Any member can READ the policy (the frontend needs it to gate nav/routes);
// only owners/admins can change it.
aiRouter.get("/policy", requireAuth, requireOrg, async (req, res, next) => {
  try {
    res.json(await getPolicy(req.organizationId!));
  } catch (err) {
    next(err);
  }
});

aiRouter.put("/policy", requireAuth, requireOrg, async (req, res, next) => {
  try {
    const roles = String(req.memberRole ?? "")
      .split(",")
      .map((s) => s.trim());
    const isAdmin = roles.some((r) => r === "owner" || r === "admin");
    if (!isAdmin) {
      throw new HttpError(403, "Only owners and admins can change this.");
    }
    const body = req.body as {
      aiEnabled?: unknown;
      disabledForEmployees?: unknown;
    };
    const saved = await savePolicy(req.organizationId!, {
      aiEnabled: Boolean(body.aiEnabled),
      disabledForEmployees: Boolean(body.disabledForEmployees),
    });
    void recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: saved.aiEnabled
        ? saved.disabledForEmployees
          ? "Restricted AI to owners and admins"
          : "Enabled the AI assistant clinic-wide"
        : "Disabled the AI assistant clinic-wide",
      entityType: "patient",
    });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// --- Per-user AI config (no clinic/RBAC needed, like /api/settings) ---------
aiRouter.get("/config", requireAuth, async (req, res, next) => {
  try {
    const row = await getAiSettings(req.user!.id);
    res.json({ config: toAiConfig(row) });
  } catch (err) {
    next(err);
  }
});

aiRouter.put("/config", requireAuth, async (req, res, next) => {
  try {
    const input = aiConfigInputSchema.parse(req.body);
    const config = await saveAiConfig(req.user!.id, input);
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// Lightweight connectivity probe before saving. For local mode we ping Ollama's
// tag list; for API mode we just confirm a key is stored (real validation
// happens on first use to avoid spending a token here).
aiRouter.post("/test", requireAuth, async (req, res, next) => {
  try {
    const input = aiTestInputSchema.parse(req.body);
    if (input.mode === "local") {
      const base = (input.ollamaBaseUrl ?? "").replace(/\/$/, "");
      if (!base) throw new HttpError(400, "Ollama base URL is required.");
      try {
        const ping = await fetch(`${base}/api/tags`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!ping.ok) throw new Error(String(ping.status));
        res.json({ ok: true, message: "Connected to Ollama." });
      } catch {
        throw new HttpError(
          502,
          "Could not reach Ollama at that URL. Is it running?",
        );
      }
      return;
    }
    const row = await getAiSettings(req.user!.id);
    const provider = input.provider ?? row.provider;
    const ok = Boolean(row.apiKeysCipher[provider]);
    res.json({
      ok,
      message: ok
        ? "API key is set."
        : "No API key stored for this provider yet.",
    });
  } catch (err) {
    next(err);
  }
});

// --- Migration import commit ------------------------------------------------
// Inserts records the clinician approved in the chat import preview. Re-validates
// server-side (never trusts the client) and reuses the audited patient service.
aiRouter.post(
  "/import",
  requireAuth,
  requireOrg,
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const records = (req.body as { records?: unknown[] }).records;
      if (!Array.isArray(records) || records.length === 0) {
        throw new HttpError(400, "No records to import.");
      }
      if (records.length > 500) {
        throw new HttpError(400, "Too many records in one import (max 500).");
      }
      const demographicsOnly = isReceptionOnly(req.memberRole);

      const created: string[] = [];
      const failed: { fileNumber?: string; error: string }[] = [];

      for (const rec of records) {
        const parsed = patientInputSchema.safeParse(rec);
        if (!parsed.success) {
          failed.push({
            fileNumber:
              (rec as { fileNumber?: string } | null)?.fileNumber ?? undefined,
            error: parsed.error.issues
              .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
              .join("; "),
          });
          continue;
        }
        try {
          const patient = await patients.createPatient(
            req.organizationId!,
            req.user!.id,
            { ...parsed.data, source: "ai" },
            demographicsOnly,
          );
          created.push(patient.fileNumber);
        } catch (err) {
          failed.push({
            fileNumber: parsed.data.fileNumber,
            error: err instanceof Error ? err.message : "Insert failed.",
          });
        }
      }

      if (created.length > 0) {
        void recordActivity({
          orgId: req.organizationId!,
          actor: { id: req.user!.id, name: req.user!.name },
          action: `${req.user!.name} imported ${created.length} patient record(s) via AI`,
          entityType: "patient",
        });
      }

      res.json({ created, failed });
    } catch (err) {
      next(err);
    }
  },
);

// --- Migration import re-validation (dry run) -------------------------------
// Powers the "review & edit before import" UI: the client edits parsed records
// and calls this to refresh which are ready vs. need fixing. Writes nothing.
aiRouter.post(
  "/import/validate",
  requireAuth,
  requireOrg,
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const records = (req.body as { records?: unknown[] }).records;
      if (!Array.isArray(records)) {
        throw new HttpError(400, "records must be an array.");
      }
      if (records.length > 500) {
        throw new HttpError(400, "Too many records (max 500).");
      }
      res.json(validatePatientImport(records));
    } catch (err) {
      next(err);
    }
  },
);
