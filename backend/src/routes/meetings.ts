import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import * as meetings from "../services/meetings.js";

export const meetingsRouter = Router();

// Staff meeting rooms (Discord-style voice/video channels), scoped to the active
// clinic. Any clinic member can list, create, and join rooms — calls are
// staff-to-staff. The live call (media + participants) is handled over Socket.io
// (see src/realtime.ts); these endpoints only manage the persistent room list.
meetingsRouter.use(requireAuth, requireOrg);

meetingsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await meetings.listRooms(req.organizationId!));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

meetingsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const room = await meetings.createRoom(
      req.organizationId!,
      name,
      req.user!.id,
    );
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

// --- Scheduled meetings (calendar) -----------------------------------------

meetingsRouter.get("/events", async (req, res, next) => {
  try {
    res.json(await meetings.listMeetingEvents(req.organizationId!, req.user!.id));
  } catch (err) {
    next(err);
  }
});

const eventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  participants: z.array(z.string()).max(50).default([]),
});

meetingsRouter.post("/events", async (req, res, next) => {
  try {
    const input = eventSchema.parse(req.body);
    const event = await meetings.createMeetingEvent(
      req.organizationId!,
      req.user!.id,
      input,
    );
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

meetingsRouter.delete("/events/:id", async (req, res, next) => {
  try {
    const ok = await meetings.deleteMeetingEvent(
      req.organizationId!,
      req.user!.id,
      String(req.params.id ?? ""),
    );
    if (!ok) throw new HttpError(404, "Meeting not found.");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

meetingsRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await meetings.deleteRoom(
      req.organizationId!,
      String(req.params.id ?? ""),
    );
    if (!ok) throw new HttpError(404, "Room not found.");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
