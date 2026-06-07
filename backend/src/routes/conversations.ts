import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireOrg } from "../middleware/auth.js";
import { emitToConversation, emitToUser } from "../realtime.js";
import * as service from "../services/messaging.js";
import { createNotification } from "../services/notifications.js";

export const conversationsRouter = Router();

// Conversations are participant-scoped within the active clinic (no extra RBAC).
conversationsRouter.use(requireAuth, requireOrg);

const createSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  name: z.string().trim().max(120).nullish(),
});

const messageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty.").max(5000),
});

// GET /api/conversations — the caller's conversations (with last message + unread)
conversationsRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await service.listConversations(req.organizationId!, req.user!.id),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/members — clinic members to start a conversation with
conversationsRouter.get("/members", async (req, res, next) => {
  try {
    res.json(
      await service.listClinicMembers(req.organizationId!, req.user!.id),
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations — create (or reuse an existing DM)
conversationsRouter.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const conversation = await service.createConversation(
      req.organizationId!,
      req.user!.id,
      input,
    );
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages — message history
conversationsRouter.get("/:id/messages", async (req, res, next) => {
  try {
    res.json(
      await service.getMessages(
        req.organizationId!,
        req.user!.id,
        req.params.id as string,
      ),
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages — send (REST fallback; also broadcasts)
conversationsRouter.post("/:id/messages", async (req, res, next) => {
  try {
    const { body } = messageSchema.parse(req.body);
    const conversationId = req.params.id as string;
    const { message, recipientIds } = await service.createMessage(
      req.organizationId!,
      req.user!.id,
      req.user!.name,
      conversationId,
      body,
    );
    emitToConversation(conversationId, "message:new", message);
    for (const recipientId of recipientIds) {
      const notification = await createNotification({
        orgId: req.organizationId!,
        userId: recipientId,
        type: "message",
        text: `New message from ${req.user!.name}`,
        entityType: "conversation",
        entityId: conversationId,
        actorName: req.user!.name,
      });
      if (notification) emitToUser(recipientId, "notification:new", notification);
    }
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/read — clear unread for the caller
conversationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    await service.markRead(
      req.organizationId!,
      req.user!.id,
      req.params.id as string,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
