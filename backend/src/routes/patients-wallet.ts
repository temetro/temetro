import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";

import { db } from "../db/index.js";
import { organization } from "../db/schema/auth.js";
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
import * as walletShare from "../services/wallet-share.js";

export const patientsWalletRouter = Router();

patientsWalletRouter.use(requireAuth, requireOrg);

const requestSchema = z.object({
  walletNumber: z.string().trim().min(1),
  mode: z.enum(["permanent", "temporary"]).default("permanent"),
  durationHours: z.number().positive().max(8760).optional(),
});

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
