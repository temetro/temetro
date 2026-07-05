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
import { expectResponse } from "../services/relay-client.js";
import * as patientService from "../services/patients.js";
import { awaitQuickTunnelUrl } from "../services/relay-url.js";
import { getNetworkEnabled } from "../services/signing.js";
import * as walletShare from "../services/wallet-share.js";
import * as walletUpdates from "../services/wallet-updates.js";

export const patientsWalletRouter = Router();

patientsWalletRouter.use(requireAuth, requireOrg);

// Wallet sharing rides the Temetro Network relay, which a clinic must opt into
// ("Join Temetro Network" in Settings → Signing). Guard the actions that need a
// live relay connection so a disabled clinic gets a clear message, not silence.
async function requireNetwork(orgId: string): Promise<void> {
  if (!(await getNetworkEnabled(orgId))) {
    throw new HttpError(
      409,
      "This clinic hasn't joined the Temetro Network. Enable it in Settings → Signing to share with patient wallets.",
    );
  }
}

// The device-reachable URL the patient's app should connect to (baked into the
// QR). Devices connect to the standalone Temetro Network relay — the same relay
// this backend is hubbed to — so RELAY_URL is the canonical answer. The legacy
// PUBLIC_RELAY_URL / cloudflared / request-host fallbacks remain for pre-relay
// self-hosting.
async function resolveRelayUrl(req: Request): Promise<string> {
  if (env.RELAY_URL) return env.RELAY_URL;
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
      await requireNetwork(req.organizationId!);
      const input = pairSchema.parse(req.body);
      const { view, ephemeralPubKey } = await walletShare.createPairingRequest(
        req.organizationId!,
        req.user!.id,
        input.mode,
        input.durationHours,
      );
      // No wallet number to `wallet:send` to yet, so pre-register the request id
      // with the relay so the scanning device's response routes back to us.
      expectResponse(req.organizationId!, view.id);
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
      await requireNetwork(req.organizationId!);
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
      emitToWallet(req.organizationId!, input.walletNumber, "wallet:share-request", {
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

// --- Clinic → wallet record-update push ------------------------------------

// Whether a patient is linked to a wallet (drives the "Push update" button).
// Returns the wallet number when linked, 404 otherwise.
patientsWalletRouter.get(
  "/link/:fileNumber",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      const walletNumber = await walletUpdates.walletNumberForPatient(
        req.organizationId!,
        req.params.fileNumber as string,
      );
      if (!walletNumber) throw new HttpError(404, "Not wallet-linked.");
      res.json({ walletNumber });
    } catch (err) {
      next(err);
    }
  },
);

const pushSchema = z.object({
  fileNumber: z.string().trim().min(1),
  changes: z.array(z.string().trim().min(1)).min(1).max(50),
});

// Push the current record snapshot to the linked wallet. Seals + signs it,
// stores it pending, and delivers live if the device is connected (it is also
// re-sent on the wallet's next connect). The patient must approve in-app.
patientsWalletRouter.post(
  "/push",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      await requireNetwork(req.organizationId!);
      const input = pushSchema.parse(req.body);
      const row = await walletUpdates.createRecordUpdate(
        req.organizationId!,
        req.user!.id,
        input.fileNumber,
        input.changes,
      );
      const event = await walletUpdates.toEvent(row);
      emitToWallet(req.organizationId!, row.walletNumber, "wallet:update-request", event);
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Pushed a record update to a patient wallet (#${row.fileNumber})`,
        entityType: "patient",
        entityId: row.fileNumber,
        patientFileNumber: row.fileNumber,
      });
      res.status(201).json(walletUpdates.viewOf(row));
    } catch (err) {
      next(err);
    }
  },
);

// The clinic's recent update pushes (Signing panel + status polling).
patientsWalletRouter.get(
  "/updates",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await walletUpdates.listUpdates(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

patientsWalletRouter.get(
  "/updates/:id",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      const view = await walletUpdates.getUpdate(
        req.organizationId!,
        req.params.id as string,
      );
      if (!view) throw new HttpError(404, "Update not found.");
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
