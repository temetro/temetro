import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { prescriptionInputSchema } from "../lib/prescription-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import * as service from "../services/prescriptions.js";

export const prescriptionsRouter = Router();

prescriptionsRouter.use(requireAuth, requireOrg);

prescriptionsRouter.get(
  "/",
  requirePermission({ prescription: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listPrescriptions(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

prescriptionsRouter.post(
  "/",
  requirePermission({ prescription: ["write"] }),
  async (req, res, next) => {
    try {
      const input = prescriptionInputSchema.parse(req.body);
      // Default the prescriber to the signed-in clinician when not provided.
      input.prescriber = input.prescriber || req.user!.name || "Clinician";
      const created = await service.createPrescription(
        req.organizationId!,
        req.user!.id,
        input,
      );
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

prescriptionsRouter.put(
  "/:id",
  requirePermission({ prescription: ["write"] }),
  async (req, res, next) => {
    try {
      const input = prescriptionInputSchema.parse(req.body);
      input.prescriber = input.prescriber || req.user!.name || "Clinician";
      const updated = await service.updatePrescription(
        req.organizationId!,
        req.params.id as string,
        input,
      );
      if (!updated) throw new HttpError(404, "Prescription not found.");
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

prescriptionsRouter.delete(
  "/:id",
  requirePermission({ prescription: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deletePrescription(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Prescription not found.");
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
