import { Router } from "express";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { emitToConversation, emitToUser } from "../realtime.js";
import * as service from "../services/messaging.js";
import { createNotification } from "../services/notifications.js";

export const conversationsRouter = Router();

// Conversations are participant-scoped within the active clinic (no extra RBAC).
conversationsRouter.use(requireAuth, requireOrg);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10mb

const createSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1),
  name: z.string().trim().max(120).nullish(),
});

const appointmentSnapshotSchema = z.object({
  fileNumber: z.string().max(120).default(""),
  name: z.string().max(200),
  date: z.string().max(40),
  time: z.string().max(40),
  type: z.string().max(120).default(""),
  provider: z.string().max(200).default(""),
  status: z.string().max(40).default(""),
});

const attachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("file"),
    attachmentId: z.string().uuid(),
    fileName: z.string().max(255),
    mimeType: z.string().max(120),
    size: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("appointment"),
    appointment: appointmentSnapshotSchema,
  }),
]);

const messageSchema = z.object({
  body: z.string().trim().max(5000).default(""),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(120).default("application/octet-stream"),
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES),
  // Raw base64 (no data: prefix).
  data: z.string().min(1),
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

// POST /api/conversations/attachments — upload a file, get its id back
conversationsRouter.post("/attachments", async (req, res, next) => {
  try {
    const input = uploadSchema.parse(req.body);
    if (Buffer.byteLength(input.data, "base64") > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(413, "File is too large (max 10MB).");
    }
    const meta = await service.createAttachment(
      req.organizationId!,
      req.user!.id,
      input,
    );
    res.status(201).json(meta);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/attachments/:id — download a file (clinic-scoped)
conversationsRouter.get("/attachments/:id", async (req, res, next) => {
  try {
    const file = await service.getAttachment(
      req.organizationId!,
      req.params.id as string,
    );
    if (!file) throw new HttpError(404, "Attachment not found.");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.send(Buffer.from(file.data, "base64"));
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
    const { body, attachments } = messageSchema.parse(req.body);
    const conversationId = req.params.id as string;
    const { message, recipientIds } = await service.createMessage(
      req.organizationId!,
      req.user!.id,
      req.user!.name,
      conversationId,
      body,
      attachments,
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
