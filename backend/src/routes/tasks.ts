import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { taskInputSchema, taskPatchSchema } from "../lib/task-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/tasks.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth, requireOrg);

tasksRouter.get(
  "/",
  requirePermission({ task: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(
        await service.listTasks(req.organizationId!, {
          userId: req.user!.id,
          role: req.memberRole ?? "",
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

tasksRouter.post(
  "/",
  requirePermission({ task: ["write"] }),
  async (req, res, next) => {
    try {
      const input = taskInputSchema.parse(req.body);
      const created = await service.createTask(
        req.organizationId!,
        { id: req.user!.id, name: req.user!.name },
        input,
      );
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: `Created task — ${created.title}`,
        entityType: "task",
        entityId: created.id,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

tasksRouter.patch(
  "/:id",
  requirePermission({ task: ["write"] }),
  async (req, res, next) => {
    try {
      const patch = taskPatchSchema.parse(req.body);
      const updated = await service.updateTask(
        req.organizationId!,
        req.params.id as string,
        patch,
      );
      if (!updated) throw new HttpError(404, "Task not found.");
      const action =
        patch.done === undefined
          ? `Updated task — ${updated.title}`
          : patch.done
            ? `Completed task — ${updated.title}`
            : `Reopened task — ${updated.title}`;
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action,
        entityType: "task",
        entityId: updated.id,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

tasksRouter.delete(
  "/:id",
  requirePermission({ task: ["delete"] }),
  async (req, res, next) => {
    try {
      const ok = await service.deleteTask(
        req.organizationId!,
        req.params.id as string,
      );
      if (!ok) throw new HttpError(404, "Task not found.");
      await recordActivity({
        orgId: req.organizationId!,
        actor: { id: req.user!.id, name: req.user!.name },
        action: "Deleted task",
        entityType: "task",
        entityId: req.params.id as string,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
