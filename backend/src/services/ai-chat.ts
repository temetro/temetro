import { randomUUID } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { aiChatMessages, aiChatThreads } from "../db/schema/ai-chat.js";
import { HttpError } from "../lib/http-error.js";

export type StoredMessage = { role: string; parts: unknown };

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export async function listThreads(
  orgId: string,
  userId: string,
): Promise<ThreadSummary[]> {
  const rows = await db
    .select({
      id: aiChatThreads.id,
      title: aiChatThreads.title,
      updatedAt: aiChatThreads.updatedAt,
    })
    .from(aiChatThreads)
    .where(
      and(
        eq(aiChatThreads.organizationId, orgId),
        eq(aiChatThreads.userId, userId),
      ),
    )
    .orderBy(desc(aiChatThreads.updatedAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getThread(
  orgId: string,
  userId: string,
  threadId: string,
): Promise<{ id: string; title: string; messages: StoredMessage[] } | null> {
  const [thread] = await db
    .select()
    .from(aiChatThreads)
    .where(
      and(
        eq(aiChatThreads.id, threadId),
        eq(aiChatThreads.organizationId, orgId),
        eq(aiChatThreads.userId, userId),
      ),
    );
  if (!thread) return null;
  const rows = await db
    .select({ role: aiChatMessages.role, parts: aiChatMessages.parts })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.threadId, threadId))
    .orderBy(asc(aiChatMessages.position));
  return {
    id: thread.id,
    title: thread.title,
    messages: rows.map((r) => ({ role: r.role, parts: r.parts })),
  };
}

// Upsert a thread and replace its messages with the supplied snapshot. The
// thread id is client-generated; ownership is enforced (you can only write your
// own threads within your clinic).
export async function saveThread(
  orgId: string,
  userId: string,
  threadId: string,
  messages: StoredMessage[],
  title: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ userId: aiChatThreads.userId })
      .from(aiChatThreads)
      .where(eq(aiChatThreads.id, threadId));
    if (existing && existing.userId !== userId) {
      throw new HttpError(403, "Not your conversation.");
    }
    if (existing) {
      await tx
        .update(aiChatThreads)
        .set({ title, updatedAt: new Date() })
        .where(eq(aiChatThreads.id, threadId));
      await tx
        .delete(aiChatMessages)
        .where(eq(aiChatMessages.threadId, threadId));
    } else {
      await tx
        .insert(aiChatThreads)
        .values({ id: threadId, organizationId: orgId, userId, title });
    }
    if (messages.length > 0) {
      await tx.insert(aiChatMessages).values(
        messages.map((m, i) => ({
          id: randomUUID(),
          threadId,
          position: i,
          role: m.role,
          parts: m.parts,
        })),
      );
    }
  });
}

export async function deleteThread(
  orgId: string,
  userId: string,
  threadId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(aiChatThreads)
    .where(
      and(
        eq(aiChatThreads.id, threadId),
        eq(aiChatThreads.organizationId, orgId),
        eq(aiChatThreads.userId, userId),
      ),
    )
    .returning({ id: aiChatThreads.id });
  return deleted.length > 0;
}
