import { and, asc, count, desc, eq, gt, inArray, ne } from "drizzle-orm";

import { db } from "../db/index.js";
import { member, user } from "../db/schema/auth.js";
import {
  conversationParticipants,
  conversations,
  messageAttachments,
  messages,
} from "../db/schema/messaging.js";
import { HttpError } from "../lib/http-error.js";
import type {
  ConversationMessage,
  ConversationSummary,
  MessageAttachment,
  Participant,
} from "../types/messaging.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- helpers ---------------------------------------------------------------

async function conversationInOrg(
  orgId: string,
  conversationId: string,
): Promise<boolean> {
  if (!UUID_RE.test(conversationId)) return false;
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.organizationId, orgId),
      ),
    );
  return !!row;
}

export async function isParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  if (!UUID_RE.test(conversationId)) return false;
  const [row] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
  return !!row;
}

async function participantIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

type BaseRow = {
  convId: string;
  name: string | null;
  isGroup: boolean;
  updatedAt: Date;
  lastReadAt: Date | null;
};

// Turns the caller's conversation rows into full summaries (participants, last
// message, unread, display name) in a few batched queries.
async function buildSummaries(
  userId: string,
  base: BaseRow[],
): Promise<ConversationSummary[]> {
  const convIds = base.map((b) => b.convId);
  if (convIds.length === 0) return [];

  const partRows = await db
    .select({
      convId: conversationParticipants.conversationId,
      userId: user.id,
      name: user.name,
    })
    .from(conversationParticipants)
    .innerJoin(user, eq(user.id, conversationParticipants.userId))
    .where(inArray(conversationParticipants.conversationId, convIds));

  const partsByConv = new Map<string, Participant[]>();
  for (const p of partRows) {
    const list = partsByConv.get(p.convId) ?? [];
    list.push({ id: p.userId, name: p.name });
    partsByConv.set(p.convId, list);
  }

  const lastByConv = new Map<string, ConversationMessage | null>();
  const unreadByConv = new Map<string, number>();
  await Promise.all(
    base.map(async (b) => {
      const [row] = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          senderName: user.name,
          body: messages.body,
          attachments: messages.attachments,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(user, eq(user.id, messages.senderId))
        .where(eq(messages.conversationId, b.convId))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      lastByConv.set(
        b.convId,
        row ? { ...row, createdAt: row.createdAt.toISOString() } : null,
      );
      // Messages from others newer than the caller's read pointer.
      const [cnt] = await db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, b.convId),
            ne(messages.senderId, userId),
            b.lastReadAt ? gt(messages.createdAt, b.lastReadAt) : undefined,
          ),
        );
      unreadByConv.set(b.convId, cnt?.value ?? 0);
    }),
  );

  return base.map((b) => {
    const participants = partsByConv.get(b.convId) ?? [];
    const others = participants.filter((p) => p.id !== userId);
    const displayName =
      b.name?.trim() ||
      (b.isGroup
        ? others.map((p) => p.name).join(", ") || "Group"
        : (others[0]?.name ?? "Conversation"));
    const lastMessage = lastByConv.get(b.convId) ?? null;
    const unreadCount = unreadByConv.get(b.convId) ?? 0;
    return {
      id: b.convId,
      name: displayName,
      isGroup: b.isGroup,
      participants,
      lastMessage,
      unread: unreadCount > 0,
      unreadCount,
      updatedAt: b.updatedAt.toISOString(),
    };
  });
}

// --- queries ---------------------------------------------------------------

export async function listConversations(
  orgId: string,
  userId: string,
): Promise<ConversationSummary[]> {
  const base = await db
    .select({
      convId: conversations.id,
      name: conversations.name,
      isGroup: conversations.isGroup,
      updatedAt: conversations.updatedAt,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        eq(conversations.organizationId, orgId),
      ),
    )
    .orderBy(desc(conversations.updatedAt));
  return buildSummaries(userId, base);
}

async function getSummary(
  orgId: string,
  userId: string,
  conversationId: string,
): Promise<ConversationSummary | null> {
  const base = await db
    .select({
      convId: conversations.id,
      name: conversations.name,
      isGroup: conversations.isGroup,
      updatedAt: conversations.updatedAt,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversations.organizationId, orgId),
      ),
    );
  const [summary] = await buildSummaries(userId, base);
  return summary ?? null;
}

export async function getMessages(
  orgId: string,
  userId: string,
  conversationId: string,
): Promise<ConversationMessage[]> {
  if (!(await conversationInOrg(orgId, conversationId))) {
    throw new HttpError(404, "Conversation not found.");
  }
  if (!(await isParticipant(conversationId, userId))) {
    throw new HttpError(403, "You are not part of this conversation.");
  }
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderName: user.name,
      body: messages.body,
      attachments: messages.attachments,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(user, eq(user.id, messages.senderId))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// Finds an existing 1:1 DM between two users in the clinic, if any.
async function findDirectConversation(
  orgId: string,
  userId: string,
  otherId: string,
): Promise<string | null> {
  const mine = await db
    .select({ convId: conversations.id })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      and(
        eq(conversations.id, conversationParticipants.conversationId),
        eq(conversations.organizationId, orgId),
        eq(conversations.isGroup, false),
      ),
    )
    .where(eq(conversationParticipants.userId, userId));
  const ids = mine.map((m) => m.convId);
  if (ids.length === 0) return null;
  const parts = await db
    .select({
      convId: conversationParticipants.conversationId,
      userId: conversationParticipants.userId,
    })
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.conversationId, ids));
  const byConv = new Map<string, Set<string>>();
  for (const p of parts) {
    const set = byConv.get(p.convId) ?? new Set<string>();
    set.add(p.userId);
    byConv.set(p.convId, set);
  }
  for (const [convId, set] of byConv) {
    if (set.size === 2 && set.has(userId) && set.has(otherId)) return convId;
  }
  return null;
}

export async function createConversation(
  orgId: string,
  userId: string,
  input: { participantIds: string[]; name?: string | null },
): Promise<ConversationSummary> {
  // Keep only valid clinic members other than the caller.
  const requested = [...new Set(input.participantIds)].filter(
    (id) => id !== userId,
  );
  const others =
    requested.length === 0
      ? []
      : (
          await db
            .select({ id: member.userId })
            .from(member)
            .where(
              and(
                eq(member.organizationId, orgId),
                inArray(member.userId, requested),
              ),
            )
        ).map((m) => m.id);

  if (others.length === 0) {
    throw new HttpError(400, "Pick at least one clinic member to message.");
  }

  const isGroup = others.length > 1 || !!input.name?.trim();

  if (!isGroup) {
    const existing = await findDirectConversation(orgId, userId, others[0]!);
    if (existing) {
      const summary = await getSummary(orgId, userId, existing);
      if (summary) return summary;
    }
  }

  const allIds = [...new Set([userId, ...others])];
  const now = new Date();
  const summary = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({
        organizationId: orgId,
        name: input.name?.trim() || null,
        isGroup,
        createdBy: userId,
      })
      .returning();
    await tx.insert(conversationParticipants).values(
      allIds.map((uid) => ({
        conversationId: conv!.id,
        userId: uid,
        // The creator has "read" the empty conversation.
        lastReadAt: uid === userId ? now : null,
      })),
    );
    return conv!.id;
  });

  const result = await getSummary(orgId, userId, summary);
  if (!result) throw new HttpError(500, "Failed to create conversation.");
  return result;
}

export async function createMessage(
  orgId: string,
  userId: string,
  senderName: string,
  conversationId: string,
  body: string,
  attachments?: MessageAttachment[] | null,
): Promise<{ message: ConversationMessage; recipientIds: string[] }> {
  if (!(await conversationInOrg(orgId, conversationId))) {
    throw new HttpError(404, "Conversation not found.");
  }
  if (!(await isParticipant(conversationId, userId))) {
    throw new HttpError(403, "You are not part of this conversation.");
  }
  const list = attachments && attachments.length > 0 ? attachments : null;
  if (!body.trim() && !list) {
    throw new HttpError(400, "Message can't be empty.");
  }
  const now = new Date();
  const [row] = await db
    .insert(messages)
    .values({ conversationId, senderId: userId, body, attachments: list })
    .returning();
  // Bump conversation recency and mark the sender's own read pointer.
  await Promise.all([
    db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId)),
    db
      .update(conversationParticipants)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      ),
  ]);

  const ids = await participantIds(conversationId);
  return {
    message: {
      id: row!.id,
      conversationId,
      senderId: userId,
      senderName,
      body: row!.body,
      attachments: row!.attachments,
      createdAt: row!.createdAt.toISOString(),
    },
    recipientIds: ids.filter((id) => id !== userId),
  };
}

// --- File attachments ------------------------------------------------------

// Store an uploaded file (base64) and return its metadata. The bytes live in the
// message_attachments table; messages reference them by id.
export async function createAttachment(
  orgId: string,
  uploaderId: string,
  input: { fileName: string; mimeType: string; size: number; data: string },
): Promise<{
  attachmentId: string;
  fileName: string;
  mimeType: string;
  size: number;
}> {
  const [row] = await db
    .insert(messageAttachments)
    .values({
      organizationId: orgId,
      uploaderId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      data: input.data,
    })
    .returning({
      id: messageAttachments.id,
      fileName: messageAttachments.fileName,
      mimeType: messageAttachments.mimeType,
      size: messageAttachments.size,
    });
  return {
    attachmentId: row!.id,
    fileName: row!.fileName,
    mimeType: row!.mimeType,
    size: row!.size,
  };
}

// Fetch an attachment's bytes for download. Scoped to the caller's clinic; ids
// are unguessable uuids, so org membership is a sufficient gate.
export async function getAttachment(
  orgId: string,
  attachmentId: string,
): Promise<{ fileName: string; mimeType: string; data: string } | null> {
  if (!UUID_RE.test(attachmentId)) return null;
  const [row] = await db
    .select({
      fileName: messageAttachments.fileName,
      mimeType: messageAttachments.mimeType,
      data: messageAttachments.data,
    })
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.id, attachmentId),
        eq(messageAttachments.organizationId, orgId),
      ),
    );
  return row ?? null;
}

export async function markRead(
  orgId: string,
  userId: string,
  conversationId: string,
): Promise<void> {
  if (!UUID_RE.test(conversationId)) return;
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
}

// --- System messages -------------------------------------------------------

// A reserved user that "sends" system messages. It has no account row, so it can
// never log in; the messages.senderId FK just needs a user to exist.
export const SYSTEM_USER_ID = "system";
export const SYSTEM_USER_NAME = "temetro System";

async function ensureSystemUser(): Promise<void> {
  await db
    .insert(user)
    .values({
      id: SYSTEM_USER_ID,
      name: SYSTEM_USER_NAME,
      email: "system@temetro.local",
      emailVerified: true,
    })
    .onConflictDoNothing();
}

// Ensure the per-clinic "System" conversation exists and includes the system
// user plus the given recipients, returning its id.
async function ensureSystemConversation(
  orgId: string,
  recipientIds: string[],
): Promise<string> {
  await ensureSystemUser();
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, orgId),
        eq(conversations.name, "System"),
        eq(conversations.createdBy, SYSTEM_USER_ID),
      ),
    )
    .limit(1);
  let convId = existing?.id;
  if (!convId) {
    const [created] = await db
      .insert(conversations)
      .values({
        organizationId: orgId,
        name: "System",
        isGroup: true,
        createdBy: SYSTEM_USER_ID,
      })
      .returning();
    convId = created!.id;
  }
  const current = new Set(await participantIds(convId));
  const toAdd = [SYSTEM_USER_ID, ...recipientIds].filter(
    (id) => !current.has(id),
  );
  if (toAdd.length > 0) {
    await db
      .insert(conversationParticipants)
      .values(
        toAdd.map((uid) => ({
          conversationId: convId!,
          userId: uid,
          lastReadAt: uid === SYSTEM_USER_ID ? new Date() : null,
        })),
      )
      .onConflictDoNothing();
  }
  return convId;
}

// Post a message from the system user into the clinic's System conversation.
export async function createSystemMessage(
  orgId: string,
  recipientIds: string[],
  body: string,
  attachment: MessageAttachment,
): Promise<{ message: ConversationMessage; recipientIds: string[] }> {
  const convId = await ensureSystemConversation(orgId, recipientIds);
  const now = new Date();
  const [row] = await db
    .insert(messages)
    .values({
      conversationId: convId,
      senderId: SYSTEM_USER_ID,
      body,
      attachments: [attachment],
    })
    .returning();
  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, convId));
  return {
    message: {
      id: row!.id,
      conversationId: convId,
      senderId: SYSTEM_USER_ID,
      senderName: SYSTEM_USER_NAME,
      body: row!.body,
      attachments: row!.attachments,
      createdAt: row!.createdAt.toISOString(),
    },
    recipientIds,
  };
}

export async function listClinicMembers(
  orgId: string,
  excludeUserId: string,
): Promise<Participant[]> {
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId));
  return rows.filter((r) => r.id !== excludeUserId);
}
