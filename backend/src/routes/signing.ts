import { Router } from "express";
import { z } from "zod";

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { connectOrg, disconnectOrg } from "../services/relay-client.js";
import * as signing from "../services/signing.js";
import * as walletShare from "../services/wallet-share.js";

export const signingRouter = Router();

signingRouter.use(requireAuth, requireOrg);

// The clinic's Ed25519 signing key (public key + fingerprint). Created lazily on
// first read so the panel always shows a real key. Readable by any clinician.
signingRouter.get(
  "/key",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await signing.getOrCreateKey(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

// Rotate the signing key — owner/admin only (gated on the org-update statement,
// which only owner/admin hold).
signingRouter.post(
  "/key/rotate",
  requirePermission({ organization: ["update"] }),
  async (req, res, next) => {
    try {
      const key = await signing.rotateKey(req.organizationId!);
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Rotated the clinic signing key",
        entityType: "settings",
      });
      res.json(key);
    } catch (err) {
      next(err);
    }
  },
);

// Whether this clinic has joined the Temetro Network relay. Readable by any
// clinician (the panel shows the toggle state + connection status).
signingRouter.get(
  "/network",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json({ enabled: await signing.getNetworkEnabled(req.organizationId!) });
    } catch (err) {
      next(err);
    }
  },
);

// Join / leave the Temetro Network — owner/admin only (same gate as key
// rotation). Enabling opens this clinic's relay hub connection; disabling tears
// it down.
const networkSchema = z.object({ enabled: z.boolean() });

signingRouter.put(
  "/network",
  requirePermission({ organization: ["update"] }),
  async (req, res, next) => {
    try {
      const { enabled } = networkSchema.parse(req.body);
      await signing.setNetworkEnabled(req.organizationId!, enabled);
      if (enabled) {
        await connectOrg(req.organizationId!);
      } else {
        disconnectOrg(req.organizationId!);
      }
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: enabled
          ? "Joined the Temetro Network"
          : "Left the Temetro Network",
        entityType: "settings",
      });
      res.json({ enabled });
    } catch (err) {
      next(err);
    }
  },
);

// Recent records shared from patient wallets — feeds the panel's shared-records
// list.
signingRouter.get(
  "/records",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await walletShare.listShareRequests(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);
