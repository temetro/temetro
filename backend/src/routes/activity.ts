import { Router } from "express";

import { requireAuth, requireOrg } from "../middleware/auth.js";
import * as service from "../services/activity.js";

export const activityRouter = Router();

// The audit feed is readable by any clinic member.
activityRouter.use(requireAuth, requireOrg);

// Whether the caller runs the clinic (owner/admin) and may therefore see the
// whole feed. Everyone else is scoped to their own actions.
function isClinicAdmin(memberRole: string | undefined): boolean {
  return String(memberRole ?? "")
    .split(",")
    .map((s) => s.trim())
    .some((r) => r === "owner" || r === "admin");
}

activityRouter.get("/", async (req, res, next) => {
  try {
    const actorId = isClinicAdmin(req.memberRole) ? undefined : req.user!.id;
    res.json(await service.listActivity(req.organizationId!, { actorId }));
  } catch (err) {
    next(err);
  }
});
