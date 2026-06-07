import { Router } from "express";

import { appointmentInputSchema } from "../lib/appointment-validation.js";
import { HttpError } from "../lib/http-error.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
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
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
