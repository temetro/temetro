import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { inventoryInputSchema } from "../lib/inventory-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/inventory.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth, requireOrg);

inventoryRouter.get(
  "/",
  requirePermission({ inventory: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listInventory(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/",
  requirePermission({ inventory: ["write"] }),
  async (req, res, next) => {
    try {
      const input = inventoryInputSchema.parse(req.body);
      const created = await service.createInventory(
        req.organizationId!,
        req.user!.id,
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Added ${created.name} to inventory`,
        entityType: "inventory",
        entityId: created.id,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.put(
  "/:id",
  requirePermission({ inventory: ["write"] }),
  async (req, res, next) => {
    try {
      const input = inventoryInputSchema.parse(req.body);
      const updated = await service.updateInventory(
        req.organizationId!,
        req.params.id as string,
        input,
      );
      if (!updated) throw new HttpError(404, "Inventory item not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Updated inventory — ${updated.name}`,
        entityType: "inventory",
        entityId: updated.id,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.delete(
  "/:id",
  requirePermission({ inventory: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deleteInventory(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Inventory item not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Deleted inventory item",
        entityType: "inventory",
        entityId: req.params.id as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
