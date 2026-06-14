import { Router } from "express";

import { requireAuth, requireOrg } from "../middleware/auth.js";
import * as service from "../services/analytics.js";

export const analyticsRouter = Router();

// Clinic analytics are readable by any member of the active clinic.
analyticsRouter.use(requireAuth, requireOrg);

analyticsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await service.getAnalytics(req.organizationId!));
  } catch (err) {
    next(err);
  }
});

// Lightweight real-time metric polled by the Live card: patients checked in today.
analyticsRouter.get("/live", async (req, res, next) => {
  try {
    res.json({ value: await service.getLiveMetric(req.organizationId!) });
  } catch (err) {
    next(err);
  }
});
