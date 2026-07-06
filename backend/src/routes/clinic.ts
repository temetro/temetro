import { Router } from "express";
import { z } from "zod";

import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as clinicSettings from "../services/clinic-settings.js";

export const clinicRouter = Router();

clinicRouter.use(requireAuth, requireOrg);

// The clinic's settings (currently just its location). Readable by any
// clinician so the app/UI can display the clinic address.
clinicRouter.get(
  "/settings",
  requirePermission({ patient: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await clinicSettings.getClinicSettings(req.organizationId!));
    } catch (err) {
      next(err);
    }
  },
);

// Set the clinic's location — owner/admin only (gated on the org-update
// statement, same as signing-key rotation / network toggle).
const locationSchema = z.object({
  address: z.string().trim().max(200).default(""),
  city: z.string().trim().max(120).default(""),
  country: z.string().trim().max(120).default(""),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
});

clinicRouter.put(
  "/location",
  requirePermission({ organization: ["update"] }),
  async (req, res, next) => {
    try {
      const location = locationSchema.parse(req.body);
      const view = await clinicSettings.setClinicLocation(
        req.organizationId!,
        location,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Updated the clinic location",
        entityType: "settings",
      });
      res.json(view);
    } catch (err) {
      next(err);
    }
  },
);
