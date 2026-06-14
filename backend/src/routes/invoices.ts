import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import { invoiceInputSchema } from "../lib/invoice-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/invoices.js";

export const invoicesRouter = Router();

// Invoices are clinic-wide billing records, gated by the caller's role.
invoicesRouter.use(requireAuth, requireOrg);

invoicesRouter.get(
  "/",
  requirePermission({ invoice: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listInvoices(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

invoicesRouter.post(
  "/",
  requirePermission({ invoice: ["write"] }),
  async (req, res, next) => {
    try {
      const input = invoiceInputSchema.parse(req.body);
      const created = await service.createInvoice(
        req.organizationId!,
        req.user!.id,
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Created invoice ${created.number} for ${created.name}`,
        entityType: "invoice",
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

invoicesRouter.put(
  "/:id",
  requirePermission({ invoice: ["write"] }),
  async (req, res, next) => {
    try {
      const input = invoiceInputSchema.parse(req.body);
      const updated = await service.updateInvoice(
        req.organizationId!,
        req.params.id as string,
        input,
      );
      if (!updated) throw new HttpError(404, "Invoice not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Updated invoice ${updated.number}`,
        entityType: "invoice",
        entityId: updated.id,
        patientName: updated.name,
        patientFileNumber: updated.fileNumber || null,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

const splitSchema = z.object({ count: z.coerce.number().int().min(1).max(36) });

invoicesRouter.post(
  "/:id/split",
  requirePermission({ invoice: ["write"] }),
  async (req, res, next) => {
    try {
      const { count } = splitSchema.parse(req.body);
      const updated = await service.splitIntoInstallments(
        req.organizationId!,
        req.params.id as string,
        count,
      );
      if (!updated) throw new HttpError(404, "Invoice not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Split invoice ${updated.number} into ${count} installments`,
        entityType: "invoice",
        entityId: updated.id,
        patientName: updated.name,
        patientFileNumber: updated.fileNumber || null,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

invoicesRouter.delete(
  "/:id",
  requirePermission({ invoice: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deleteInvoice(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Invoice not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Deleted invoice",
        entityType: "invoice",
        entityId: req.params.id as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
