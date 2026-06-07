import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { taskInputSchema, taskPatchSchema } from "../lib/task-validation.js";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../middleware/auth.js";
import * as service from "../services/tasks.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth, requireOrg);

tasksRouter.get(
  "/",
  requirePermission({ task: ["read"] }),
  async (req, res, next) => {
    try {
      res.json(await service.listTasks(req.organizationId!));
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
        req.user!.id,
        input,
      );
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
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
