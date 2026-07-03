import type { Server as HttpServer } from "node:http";

import { fromNodeHeaders } from "better-auth/node";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { Server, type Socket } from "socket.io";

import { auth } from "./auth.js";
import { env } from "./env.js";
import { decodeWalletNumber, verifySignature } from "./lib/wallet-crypto.js";
import * as meetings from "./services/meetings.js";
import * as messaging from "./services/messaging.js";
import { createNotification } from "./services/notifications.js";
import * as walletShare from "./services/wallet-share.js";
import * as walletUpdates from "./services/wallet-updates.js";
import type { MessageAttachment } from "./types/messaging.js";

let io: Server | null = null;

const userRoom = (userId: string) => `user:${userId}`;
const convRoom = (conversationId: string) => `conv:${conversationId}`;
const callRoom = (roomId: string) => `call:${roomId}`;
const orgRoom = (orgId: string) => `org:${orgId}`;
const walletRoom = (walletNumber: string) => `wallet:${walletNumber}`;

// Mesh WebRTC tops out around four peers (each sends its stream to every other);
// past that the room is closed to new joiners.
const MAX_CALL_PEERS = 4;

// Live call participants per room: roomId -> (socketId -> peer info). Ephemeral —
// nothing about an in-call session is persisted.
type CallPeer = { socketId: string; userId: string; userName: string };
const callParticipants = new Map<string, Map<string, CallPeer>>();

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

// Relay an end-to-end-encrypted message to a patient wallet device (the /wallet
// namespace, room keyed by wallet number). The relay only ever forwards
// ciphertext — it cannot read the record bundle.
export function emitToWallet(
  walletNumber: string,
  event: string,
  data: unknown,
): void {
  io?.of("/wallet").to(walletRoom(walletNumber)).emit(event, data);
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

    // Personal room for notifications; clinic room for call presence broadcasts.
    socket.join(userRoom(userId));
    if (orgId) socket.join(orgRoom(orgId));

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

    // --- Staff calls (WebRTC mesh signaling) -------------------------------
    // The server only relays SDP/ICE between peers and tracks who's in a room;
    // media flows peer-to-peer and never touches the server. Rooms are
    // org-scoped: a join is authorized against the clinic's meeting_rooms.
    const joinedCallRooms = new Set<string>();

    // Broadcast a room's live occupancy to the whole clinic so the meetings
    // room list can show "N in call".
    const emitPresence = (roomId: string) => {
      if (!orgId) return;
      const count = callParticipants.get(roomId)?.size ?? 0;
      io?.to(orgRoom(orgId)).emit("call:presence", { roomId, count });
    };

    const leaveCall = (roomId: string) => {
      if (!joinedCallRooms.has(roomId)) return;
      joinedCallRooms.delete(roomId);
      socket.leave(callRoom(roomId));
      callParticipants.get(roomId)?.delete(socket.id);
      if (callParticipants.get(roomId)?.size === 0) {
        callParticipants.delete(roomId);
      }
      socket.to(callRoom(roomId)).emit("call:peer-left", { socketId: socket.id });
      emitPresence(roomId);
    };

    socket.on("call:join", async (roomId: unknown, ack?: Ack) => {
      try {
        const id = String(roomId ?? "");
        if (!(id && orgId && (await meetings.roomExists(orgId, id)))) {
          ack?.({ ok: false, reason: "not_found" });
          return;
        }
        const peers = callParticipants.get(id) ?? new Map<string, CallPeer>();
        if (!peers.has(socket.id) && peers.size >= MAX_CALL_PEERS) {
          ack?.({ ok: false, reason: "full" });
          return;
        }
        socket.join(callRoom(id));
        joinedCallRooms.add(id);
        const me: CallPeer = { socketId: socket.id, userId, userName };
        peers.set(socket.id, me);
        callParticipants.set(id, peers);
        // Tell existing peers a newcomer arrived; the newcomer initiates offers.
        socket.to(callRoom(id)).emit("call:peer-joined", me);
        emitPresence(id);
        // Reply with the peers already present (excluding self).
        ack?.({
          ok: true,
          peers: [...peers.values()].filter((p) => p.socketId !== socket.id),
        });
      } catch {
        ack?.({ ok: false, reason: "error" });
      }
    });

    // Ring a clinic member into a room: push a live invite + a bell notification.
    socket.on(
      "call:invite",
      async (payload: { roomId?: string; toUserId?: string }) => {
        try {
          const roomId = String(payload?.roomId ?? "");
          const toUserId = String(payload?.toUserId ?? "");
          if (!(roomId && toUserId && orgId)) return;
          if (!(await meetings.roomExists(orgId, roomId))) return;
          const room = (await meetings.listRooms(orgId)).find(
            (r) => r.id === roomId,
          );
          const roomName = room?.name ?? "";
          emitToUser(toUserId, "call:invite", {
            roomId,
            roomName,
            fromName: userName,
          });
          const notification = await createNotification({
            orgId,
            userId: toUserId,
            type: "meeting",
            text: `${userName} invited you to a call`,
            entityType: "meeting",
            entityId: roomId,
            actorName: userName,
          });
          if (notification) {
            emitToUser(toUserId, "notification:new", notification);
          }
        } catch {
          /* best-effort */
        }
      },
    );

    // Relay an SDP offer/answer or ICE candidate to a specific peer socket.
    socket.on(
      "call:signal",
      (payload: { to?: string; signal?: unknown }) => {
        const to = String(payload?.to ?? "");
        if (!to) return;
        io?.to(to).emit("call:signal", {
          from: socket.id,
          signal: payload.signal,
        });
      },
    );

    socket.on("call:leave", (roomId: unknown) => {
      leaveCall(String(roomId ?? ""));
    });

    socket.on("disconnect", () => {
      for (const roomId of joinedCallRooms) {
        callParticipants.get(roomId)?.delete(socket.id);
        if (callParticipants.get(roomId)?.size === 0) {
          callParticipants.delete(roomId);
        }
        socket
          .to(callRoom(roomId))
          .emit("call:peer-left", { socketId: socket.id });
        emitPresence(roomId);
      }
    });
  });

  // --- Patient wallet relay (/wallet namespace) ----------------------------
  // Devices have no clinic session, so this namespace is NOT cookie-gated.
  // Instead a device proves control of its wallet keypair: the server issues a
  // random challenge, the device signs it with its Ed25519 key, and only then
  // may it join its own wallet room. The relay forwards encrypted share
  // requests/responses without ever reading the record bundle.
  const walletNs = io.of("/wallet");
  walletNs.on("connection", (socket: Socket) => {
    const challenge = bytesToHex(randomBytes(32));
    socket.data.challenge = challenge;
    socket.data.walletNumber = null as string | null;
    socket.emit("wallet:challenge", { challenge });

    socket.on(
      "wallet:auth",
      (payload: { walletNumber?: string; signature?: string }, ack?: Ack) => {
        try {
          const walletNumber = String(payload?.walletNumber ?? "");
          const signature = String(payload?.signature ?? "");
          const publicKey = decodeWalletNumber(walletNumber);
          const ok = verifySignature(
            publicKey,
            signature,
            utf8ToBytes(socket.data.challenge as string),
          );
          if (!ok) {
            ack?.({ ok: false });
            return;
          }
          socket.data.walletNumber = walletNumber;
          socket.join(walletRoom(walletNumber));
          ack?.({ ok: true });
          // Deliver any record updates the device missed while offline. Sent
          // after the ack so the client is ready to receive them.
          void walletUpdates
            .pendingUpdatesForWallet(walletNumber)
            .then(async (rows) => {
              for (const row of rows) {
                socket.emit("wallet:update-request", await walletUpdates.toEvent(row));
                await walletUpdates.markDelivered(row.id);
              }
            })
            .catch(() => {});
        } catch {
          ack?.({ ok: false });
        }
      },
    );

    // The patient approved/denied a clinic→wallet record update on their device.
    // We verify the wallet's signature over the decision and resolve the row.
    socket.on(
      "wallet:update-response",
      async (
        payload: {
          requestId?: string;
          walletNumber?: string;
          decision?: "approved" | "denied";
          signature?: string;
        },
        ack?: Ack,
      ) => {
        try {
          if (
            !socket.data.walletNumber ||
            socket.data.walletNumber !== payload?.walletNumber
          ) {
            ack?.({ ok: false });
            return;
          }
          const view = await walletUpdates.applyUpdateResponse(
            String(payload?.requestId ?? ""),
            String(payload?.walletNumber ?? ""),
            payload?.decision === "approved" ? "approved" : "denied",
            payload?.signature,
          );
          ack?.({ ok: !!view });
        } catch (err) {
          ack?.({ ok: false, error: (err as Error).message });
        }
      },
    );

    // The patient approved/denied a share on their device; the sealed bundle (if
    // approved) rides along and is decrypted + verified server-side.
    socket.on(
      "wallet:share-response",
      async (
        payload: {
          requestId?: string;
          walletNumber?: string;
          decision?: "approved" | "denied";
          sealed?: string;
          signature?: string;
        },
        ack?: Ack,
      ) => {
        try {
          if (
            !socket.data.walletNumber ||
            socket.data.walletNumber !== payload?.walletNumber
          ) {
            ack?.({ ok: false });
            return;
          }
          const view = await walletShare.applyShareResponse(
            String(payload?.requestId ?? ""),
            String(payload?.walletNumber ?? ""),
            payload?.decision === "approved" ? "approved" : "denied",
            payload?.sealed,
            payload?.signature,
          );
          ack?.({ ok: !!view });
        } catch (err) {
          ack?.({ ok: false, error: (err as Error).message });
        }
      },
    );

    // The patient revoked a previously shared record; delete it from the clinic.
    socket.on(
      "wallet:revoke",
      async (
        payload: { requestId?: string; walletNumber?: string },
        ack?: Ack,
      ) => {
        try {
          if (
            !socket.data.walletNumber ||
            socket.data.walletNumber !== payload?.walletNumber
          ) {
            ack?.({ ok: false });
            return;
          }
          const result = await walletShare.revokeShare(
            String(payload?.requestId ?? ""),
            String(payload?.walletNumber ?? ""),
          );
          ack?.({ ok: !!result });
        } catch {
          ack?.({ ok: false });
        }
      },
    );
  });

  return io;
}
