import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import * as service from "../services/notifications.js";

export const notificationsRouter = Router();

// Notifications are per-recipient within the active clinic (no extra RBAC).
notificationsRouter.use(requireAuth, requireOrg);

// GET /api/notifications — recent notifications + unread count for the caller
notificationsRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await service.listNotifications(req.organizationId!, req.user!.id),
    );
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read — mark one read
notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const ok = await service.markRead(
      req.organizationId!,
      req.user!.id,
      req.params.id as string,
    );
    if (!ok) throw new HttpError(404, "Notification not found.");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all — mark all read
notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    await service.markAllRead(req.organizationId!, req.user!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
