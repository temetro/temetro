import { Router } from "express";

import { HttpError } from "../lib/http-error.js";
import { noteInputSchema } from "../lib/note-validation.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import * as service from "../services/notes.js";

export const notesRouter = Router();

// Notes are scoped to the active clinic AND the signed-in author. Any clinic
// member may manage their own notes, so no extra RBAC permission is required.
notesRouter.use(requireAuth, requireOrg);

notesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await service.listNotes(req.organizationId!, req.user!.id));
  } catch (err) {
    next(err);
  }
});

notesRouter.post("/", async (req, res, next) => {
  try {
    const input = noteInputSchema.parse(req.body);
    const created = await service.createNote(
      req.organizationId!,
      req.user!.id,
      input,
    );
    await recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: `Created note — ${created.title}`,
      entityType: "note",
      entityId: created.id,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

notesRouter.get("/:id", async (req, res, next) => {
  try {
    const note = await service.getNote(
      req.organizationId!,
      req.user!.id,
      req.params.id as string,
    );
    if (!note) throw new HttpError(404, "Note not found.");
    res.json(note);
  } catch (err) {
    next(err);
  }
});

notesRouter.put("/:id", async (req, res, next) => {
  try {
    const input = noteInputSchema.parse(req.body);
    const updated = await service.updateNote(
      req.organizationId!,
      req.user!.id,
      req.params.id as string,
      input,
    );
    if (!updated) throw new HttpError(404, "Note not found.");
    await recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: `Updated note — ${updated.title}`,
      entityType: "note",
      entityId: updated.id,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

notesRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await service.deleteNote(
      req.organizationId!,
      req.user!.id,
      req.params.id as string,
    );
    if (!ok) throw new HttpError(404, "Note not found.");
    await recordActivity({
      orgId: req.organizationId!,
      actor: { id: req.user!.id, name: req.user!.name },
      action: "Deleted note",
      entityType: "note",
      entityId: req.params.id as string,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
