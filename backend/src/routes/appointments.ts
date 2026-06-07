import { Router } from "express";

import { appointmentInputSchema } from "../lib/appointment-validation.js";
import { HttpError } from "../lib/http-error.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/appointments.js";

export const appointmentsRouter = Router();

// Appointments are clinic-wide records, gated by the caller's role like patients.
appointmentsRouter.use(requireAuth, requireOrg);

appointmentsRouter.get(
  "/",
  requirePermission({ appointment: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listAppointments(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

appointmentsRouter.post(
  "/",
  requirePermission({ appointment: ["write"] }),
  async (req, res, next) => {
    try {
      const input = appointmentInputSchema.parse(req.body);
      const created = await service.createAppointment(
        req.organizationId!,
        req.user!.id,
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Scheduled appointment for ${created.name} on ${created.date}`,
        entityType: "appointment",
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

appointmentsRouter.put(
  "/:id",
  requirePermission({ appointment: ["write"] }),
  async (req, res, next) => {
    try {
      const input = appointmentInputSchema.parse(req.body);
      const updated = await service.updateAppointment(
        req.organizationId!,
        req.params.id as string,
        input,
      );
      if (!updated) throw new HttpError(404, "Appointment not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Updated appointment for ${updated.name}`,
        entityType: "appointment",
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

appointmentsRouter.delete(
  "/:id",
  requirePermission({ appointment: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deleteAppointment(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Appointment not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Deleted appointment",
        entityType: "appointment",
        entityId: req.params.id as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
