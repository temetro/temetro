import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { patientInputSchema } from "../lib/patient-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { emitToUser } from "../realtime.js";
import { recordActivity } from "../services/activity.js";
import { listClinicMembers } from "../services/messaging.js";
import { createNotification } from "../services/notifications.js";
import * as service from "../services/patients.js";

export const patientsRouter = Router();

// The `reception` role is scoped to scheduling + registration: it sees and
// writes patient demographics only, never clinical PHI. True only when the
// caller's role set is reception without any clinical-capable role.
function isReceptionOnly(memberRole?: string): boolean {
  const names = String(memberRole ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.includes("reception")) return false;
  return !names.some((r) => ["owner", "admin", "doctor", "member"].includes(r));
}

// Notify the rest of the clinic about a patient record change (best-effort,
// pushed live over the socket).
async function notifyClinic(
  orgId: string,
  actor: { id: string; name: string },
  text: string,
  fileNumber: string,
): Promise<void> {
  try {
    const members = await listClinicMembers(orgId, actor.id);
    for (const m of members) {
      const notification = await createNotification({
        orgId,
        userId: m.id,
        type: "record_change",
        text,
        entityType: "patient",
        entityId: fileNumber,
        actorName: actor.name,
      });
      if (notification) emitToUser(m.id, "notification:new", notification);
    }
  } catch (err) {
    console.error("Failed to notify clinic:", err);
  }
}

// Every patient route requires a signed-in user with an active clinic.
patientsRouter.use(requireAuth, requireOrg);

patientsRouter.get(
  "/",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(
        await service.listPatients(
          req.organizationId!,
          isReceptionOnly(req.memberRole),
        ),
      );
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
        isReceptionOnly(req.memberRole),
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
        isReceptionOnly(req.memberRole),
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
      await notifyClinic(
        req.organizationId!,
        { id: req.user!.id, name: req.user!.name },
        `${req.user!.name} added patient ${created.name}`,
        created.fileNumber,
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
        isReceptionOnly(req.memberRole),
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
      await notifyClinic(
        req.organizationId!,
        { id: req.user!.id, name: req.user!.name },
        `${req.user!.name} updated ${updated.name}'s record`,
        updated.fileNumber,
      );
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
