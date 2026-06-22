import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import type { Request } from "express";

import { db } from "../db/index.js";
import { organization } from "../db/schema/auth.js";
import { env } from "../env.js";
import { HttpError } from "../lib/http-error.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import { isReceptionOnly } from "../lib/role-scope.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { emitToWallet } from "../realtime.js";
import { recordActivity } from "../services/activity.js";
import * as patientService from "../services/patients.js";
import { awaitQuickTunnelUrl } from "../services/relay-url.js";
import * as walletShare from "../services/wallet-share.js";

export const patientsWalletRouter = Router();

patientsWalletRouter.use(requireAuth, requireOrg);

// The device-reachable URL the patient's app should connect to (baked into the
// QR). Prefer an explicit PUBLIC_RELAY_URL; otherwise derive it from the request
// host so that opening the web app over the LAN yields a reachable LAN URL.
async function resolveRelayUrl(req: Request): Promise<string> {
  if (env.PUBLIC_RELAY_URL) return env.PUBLIC_RELAY_URL;
  // A cloudflared quick tunnel (`npm run docker:tunnel`). Wait briefly for it to
  // become reachable so the QR never carries a not-yet-live URL.
  if (env.CLOUDFLARED_METRICS_URL) {
    const tunnel = await awaitQuickTunnelUrl(env.CLOUDFLARED_METRICS_URL);
    if (tunnel) return tunnel;
  }
  const host = req.get("host");
  if (host) {
    // Behind a TLS-terminating proxy (Fly/Render/etc.) req.protocol is "http";
    // trust x-forwarded-proto so the QR carries an https URL — the phone then
    // connects over wss, which iOS App Transport Security requires.
    const proto =
      req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
    return `${proto}://${host}`;
  }
  return env.BETTER_AUTH_URL;
}

const requestSchema = z.object({
  walletNumber: z.string().trim().min(1),
  mode: z.enum(["permanent", "temporary"]).default("permanent"),
  durationHours: z.number().positive().max(8760).optional(),
});

const pairSchema = z.object({
  mode: z.enum(["permanent", "temporary"]).default("permanent"),
  durationHours: z.number().positive().max(8760).optional(),
});

// Create a QR pairing request (no wallet number yet). Returns the request id +
// the ephemeral public key the device seals its bundle to; the clinic encodes
// both — plus its own relay URL — into the QR the patient scans.
patientsWalletRouter.post(
  "/pair",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const input = pairSchema.parse(req.body);
      const { view, ephemeralPubKey } = await walletShare.createPairingRequest(
        req.organizationId!,
        req.user!.id,
        input.mode,
        input.durationHours,
      );
      res.status(201).json({
        ...view,
        ephemeralPubKey,
        relayUrl: await resolveRelayUrl(req),
      });
    } catch (err) {
      next(err);
    }
  },
);

// Start an import: validate the wallet number, mint a per-request ephemeral key,
// and relay an encrypted-share request to the patient's device. The clinician
// then polls the request until the patient approves on their phone.
patientsWalletRouter.post(
  "/request-share",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const input = requestSchema.parse(req.body);
      const { view, ephemeralPubKey } = await walletShare.createShareRequest(
        req.organizationId!,
        req.user!.id,
        input.walletNumber,
        input.mode,
        input.durationHours,
      );
      const [org] = await db
        .select({ name: organization.name })
        .from(organization)
        .where(eq(organization.id, req.organizationId!));
      emitToWallet(input.walletNumber, "wallet:share-request", {
        requestId: view.id,
        clinicName: org?.name ?? "A clinic",
        requestedBy: req.user!.name,
        ephemeralPubKey,
        mode: input.mode,
        durationHours: input.durationHours ?? null,
      });
      res.status(201).json(view);
    } catch (err) {
      next(err);
    }
  },
);

// Poll a request's status (and, once approved, the decrypted draft record).
patientsWalletRouter.get(
  "/request-share/:id",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      const view = await walletShare.getShareRequest(
        req.organizationId!,
        req.params.id as string,
      );
      if (!view) throw new HttpError(404, "Share request not found.");
      res.json(view);
    } catch (err) {
      next(err);
    }
  },
);

// Commit the (possibly clinician-edited) draft into a real patient record. The
// temporary-share metadata (origin + auto-delete deadline) is taken from the
// request server-side, so the clinic can't quietly keep a temporary record.
patientsWalletRouter.post(
  "/request-share/:id/commit",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const request = await walletShare.getShareRequest(req.organizationId!, id);
      if (!request) throw new HttpError(404, "Share request not found.");
      if (request.status !== "approved") {
        throw new HttpError(409, "This share has not been approved yet.");
      }
      const input = patientInputSchema.parse(req.body);
      const created = await patientService.createPatient(
        req.organizationId!,
        req.user!.id,
        input,
        isReceptionOnly(req.memberRole),
        {
          shareOrigin: "wallet",
          shareExpiresAt: request.shareExpiresAt
            ? new Date(request.shareExpiresAt)
            : null,
        },
      );
      await walletShare.markCommitted(
        req.organizationId!,
        id,
        created.fileNumber,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Imported patient ${created.name} from a wallet${
          request.shareMode === "temporary" ? " (temporary)" : ""
        }`,
        entityType: "patient",
        entityId: created.fileNumber,
        patientName: created.name,
        patientFileNumber: created.fileNumber,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);
