import { Router } from "express";

import { dispenseInputSchema } from "../lib/dispense-validation.js";
import { HttpError } from "../lib/http-error.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/dispenses.js";

// The dispensing ledger. Reuses the `inventory` RBAC statement (pharmacy holds
// inventory read/write), so no new access-control role is needed.
export const dispensesRouter = Router();

dispensesRouter.use(requireAuth, requireOrg);

dispensesRouter.get(
  "/",
  requirePermission({ inventory: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listDispenses(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

dispensesRouter.post(
  "/",
  requirePermission({ inventory: ["write"] }),
  async (req, res, next) => {
    try {
      const input = dispenseInputSchema.parse(req.body);
      const created = await service.createDispense(
        req.organizationId!,
        { id: req.user!.id, name: req.user!.name || "Pharmacy" },
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Dispensed ${created.medication} to ${created.name}`,
        entityType: "dispense",
        entityId: created.id,
        patientName: created.name,
        patientFileNumber: created.fileNumber || null,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

dispensesRouter.delete(
  "/:id",
  requirePermission({ inventory: ["write"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deleteDispense(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Dispense not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Voided a dispense record",
        entityType: "dispense",
        entityId: req.params.id as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
