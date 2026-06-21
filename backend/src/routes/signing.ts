import { Router } from "express";

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
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
