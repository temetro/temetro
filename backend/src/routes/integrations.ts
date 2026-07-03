import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import {
  requireAnyPermission,
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as claims from "../services/integrations/claims.js";
import {
  getConfig,
  getCredentials,
  type IntegrationType,
  INTEGRATION_TYPES,
  listConfigs,
  saveConfig,
} from "../services/integrations/config.js";
import { createKey, listKeys, revokeKey } from "../services/fhir-server/keys.js";
import * as eprescribe from "../services/integrations/eprescribe.js";
import * as fhir from "../services/integrations/fhir.js";

export const integrationsRouter = Router();

function parseType(value: string): IntegrationType {
  if ((INTEGRATION_TYPES as readonly string[]).includes(value)) {
    return value as IntegrationType;
  }
  throw new HttpError(404, "Unknown integration.");
}

function assertAdmin(role: string | undefined): void {
  const isAdmin = String(role ?? "")
    .split(",")
    .map((s) => s.trim())
    .some((r) => r === "owner" || r === "admin");
  if (!isAdmin) {
    throw new HttpError(403, "Only owners and admins can change integrations.");
  }
}

// Test a connection against the credentials/endpoint the type's service expects.
function bearerFromCreds(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return raw.trim() || null;
  }
}

// --- Config (read for any member; write for owners/admins) ------------------

integrationsRouter.get(
  "/",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      res.json(await listConfigs(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

const configSchema = z.object({
  endpoint: z.string().trim().max(2048).optional(),
  enabled: z.boolean().optional(),
  // Empty string clears the stored secret; omitted leaves it unchanged.
  credentials: z.string().max(8192).optional(),
});

integrationsRouter.put(
  "/:type",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      assertAdmin(req.memberRole);
      const type = parseType(String(req.params.type));
      const input = configSchema.parse(req.body);
      const saved = await saveConfig(req.organizationId!, type, input);
      void recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Updated the ${type} integration`,
        entityType: "patient",
      });
      res.json(saved);
    } catch (err) {
      next(err);
    }
  },
);

integrationsRouter.post(
  "/:type/test",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      assertAdmin(req.memberRole);
      const type = parseType(String(req.params.type));
      const orgId = req.organizationId!;
      const config = await getConfig(orgId, type);
      const token = bearerFromCreds(await getCredentials(orgId, type));
      const tester =
        type === "fhir"
          ? fhir.testConnection
          : type === "eprescribe"
            ? eprescribe.testConnection
            : claims.testConnection;
      res.json(await tester(config.endpoint, token));
    } catch (err) {
      next(err);
    }
  },
);

// --- FHIR server API keys (owner/admin only) --------------------------------
// These credential the read-only /fhir server. The plaintext secret is returned
// exactly once (on creation) and only its hash is stored.

integrationsRouter.get(
  "/fhir-server/keys",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      assertAdmin(req.memberRole);
      res.json(await listKeys(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

const createKeySchema = z.object({ name: z.string().trim().min(1).max(120) });

integrationsRouter.post(
  "/fhir-server/keys",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      assertAdmin(req.memberRole);
      const { name } = createKeySchema.parse(req.body);
      const { secret, key } = await createKey(
        req.organizationId!,
        name,
        req.user!.id,
      );
      void recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Created a FHIR API key ("${key.name}")`,
        entityType: "settings",
      });
      // `secret` is present only in this response — the client must show it now.
      res.status(201).json({ ...key, secret });
    } catch (err) {
      next(err);
    }
  },
);

integrationsRouter.delete(
  "/fhir-server/keys/:id",
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      assertAdmin(req.memberRole);
      const revoked = await revokeKey(req.organizationId!, String(req.params.id));
      if (!revoked) throw new HttpError(404, "API key not found.");
      void recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Revoked a FHIR API key",
        entityType: "settings",
      });
      res.json({ revoked: true });
    } catch (err) {
      next(err);
    }
  },
);

// --- Actions ----------------------------------------------------------------

const syncSchema = z.object({ fileNumber: z.string().trim().min(1) });

// Pull lab results for a patient from the FHIR server.
integrationsRouter.post(
  "/fhir/sync",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["write"] }, { lab: ["write"] }),
  async (req, res, next) => {
    try {
      const { fileNumber } = syncSchema.parse(req.body);
      res.json(await fhir.syncLabs(req.organizationId!, fileNumber));
    } catch (err) {
      next(err);
    }
  },
);

const ingestSchema = z.object({
  fileNumber: z.string().trim().min(1),
  message: z.string().min(1),
});

// Ingest a raw HL7 v2 ORU result message for a patient.
integrationsRouter.post(
  "/fhir/ingest",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["write"] }, { lab: ["write"] }),
  async (req, res, next) => {
    try {
      const { fileNumber, message } = ingestSchema.parse(req.body);
      res.json(await fhir.ingestHl7(req.organizationId!, fileNumber, message));
    } catch (err) {
      next(err);
    }
  },
);

const sendRxSchema = z.object({ rxId: z.string().trim().min(1) });

// Transmit a prescription to a pharmacy (NCPDP SCRIPT NewRx).
integrationsRouter.post(
  "/eprescribe/send",
  requireAuth,
  requireOrg,
  requirePermission({ prescription: ["write"] }),
  async (req, res, next) => {
    try {
      const { rxId } = sendRxSchema.parse(req.body);
      res.json(await eprescribe.sendRx(req.organizationId!, rxId));
    } catch (err) {
      next(err);
    }
  },
);

const submitClaimSchema = z.object({ invoiceId: z.string().trim().min(1) });

// Submit an insurance claim for an invoice (X12 837P) + read the remittance.
integrationsRouter.post(
  "/claims/submit",
  requireAuth,
  requireOrg,
  requirePermission({ invoice: ["write"] }),
  async (req, res, next) => {
    try {
      const { invoiceId } = submitClaimSchema.parse(req.body);
      res.json(await claims.submitClaim(req.organizationId!, invoiceId));
    } catch (err) {
      next(err);
    }
  },
);
