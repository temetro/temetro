import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
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
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
