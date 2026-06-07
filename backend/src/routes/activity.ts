import { Router } from "express";

import { requireAuth, requireOrg } from "../middleware/auth.js";
import * as service from "../services/activity.js";

export const activityRouter = Router();

// The audit feed is readable by any clinic member.
activityRouter.use(requireAuth, requireOrg);

activityRouter.get("/", async (req, res, next) => {
  try {
    res.json(await service.listActivity(req.organizationId!));
  } catch (err) {
    next(err);
  }
});
