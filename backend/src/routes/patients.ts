import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/patients.js";

export const patientsRouter = Router();

// Every patient route requires a signed-in user with an active clinic.
patientsRouter.use(requireAuth, requireOrg);

patientsRouter.get(
  "/",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listPatients(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

patientsRouter.get(
  "/:fileNumber",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      const patient = await service.getPatient(
        req.organizationId!,
        req.params.fileNumber as string,
      );
      if (!patient) throw new HttpError(404, "Patient not found.");
      res.json(patient);
    } catch (err) {
      next(err);
    }
  },
);

patientsRouter.post(
  "/",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const input = patientInputSchema.parse(req.body);
      const created = await service.createPatient(
        req.organizationId!,
        req.user!.id,
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Created patient ${created.name}`,
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

patientsRouter.put(
  "/:fileNumber",
  requirePermission({ patient: ["write"] }),
  async (req, res, next) => {
    try {
      const input = patientInputSchema.parse(req.body);
      const updated = await service.updatePatient(
        req.organizationId!,
        req.params.fileNumber as string,
        input,
      );
      if (!updated) throw new HttpError(404, "Patient not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Updated patient ${updated.name}`,
        entityType: "patient",
        entityId: updated.fileNumber,
        patientName: updated.name,
        patientFileNumber: updated.fileNumber,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

patientsRouter.delete(
  "/:fileNumber",
  requirePermission({ patient: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deletePatient(
        req.organizationId!,
        req.params.fileNumber as string,
      );
      if (!ok) throw new HttpError(404, "Patient not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Deleted patient #${req.params.fileNumber}`,
        entityType: "patient",
        entityId: req.params.fileNumber as string,
        patientFileNumber: req.params.fileNumber as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
