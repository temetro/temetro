import type { Server as HttpServer } from "node:http";

import { fromNodeHeaders } from "better-auth/node";
import { Server, type Socket } from "socket.io";

import { auth } from "./auth.js";
import { env } from "./env.js";
import * as messaging from "./services/messaging.js";
import { createNotification } from "./services/notifications.js";
import type { MessageAttachment } from "./types/messaging.js";

let io: Server | null = null;

const userRoom = (userId: string) => `user:${userId}`;
const convRoom = (conversationId: string) => `conv:${conversationId}`;

// Push helpers other modules can call without importing socket.io directly.
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(userRoom(userId)).emit(event, data);
}

export function emitToConversation(
  conversationId: string,
  event: string,
  data: unknown,
): void {
  io?.to(convRoom(conversationId)).emit(event, data);
}

type Ack = (response: { ok: boolean; [key: string]: unknown }) => void;

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  // Authenticate the handshake with the Better Auth session cookie.
  io.use(async (socket, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.request.headers),
      });
      if (!session?.session) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.userId = session.user.id;
      socket.data.userName = session.user.name;
      socket.data.orgId = session.session.activeOrganizationId ?? null;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId: string = socket.data.userId;
    const userName: string = socket.data.userName;
    const orgId: string | null = socket.data.orgId;

    // Personal room for notifications.
    socket.join(userRoom(userId));

    socket.on(
      "conversation:join",
      async (conversationId: string, ack?: Ack) => {
        try {
          if (await messaging.isParticipant(conversationId, userId)) {
            socket.join(convRoom(conversationId));
            ack?.({ ok: true });
          } else {
            ack?.({ ok: false });
          }
        } catch {
          ack?.({ ok: false });
        }
      },
    );

    socket.on(
      "message:send",
      async (
        payload: {
          conversationId?: string;
          body?: string;
          attachments?: MessageAttachment[];
        },
        ack?: Ack,
      ) => {
        try {
          const conversationId = String(payload?.conversationId ?? "");
          const body = String(payload?.body ?? "").trim();
          const attachments = Array.isArray(payload?.attachments)
            ? payload.attachments
            : undefined;
          // Allow attachment-only messages; the service re-validates.
          if (!(conversationId && orgId && (body || attachments?.length))) {
            ack?.({ ok: false });
            return;
          }
          const { message, recipientIds } = await messaging.createMessage(
            orgId,
            userId,
            userName,
            conversationId,
            body,
            attachments,
          );
          emitToConversation(conversationId, "message:new", message);

          // Notify the other participants (best-effort) and push live.
          for (const recipientId of recipientIds) {
            const notification = await createNotification({
              orgId,
              userId: recipientId,
              type: "message",
              text: `New message from ${userName}`,
              entityType: "conversation",
              entityId: conversationId,
              actorName: userName,
            });
            if (notification) emitToUser(recipientId, "notification:new", notification);
          }
          ack?.({ ok: true, message });
        } catch {
          ack?.({ ok: false });
        }
      },
    );

    socket.on("message:read", async (conversationId: string) => {
      if (orgId) {
        await messaging.markRead(orgId, userId, conversationId).catch(() => {});
      }
    });
  });

  return io;
}
