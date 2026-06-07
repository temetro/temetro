import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { notifications } from "../db/schema/notifications.js";
import type { Notification } from "../types/notification.js";
import { initialsOf } from "./activity.js";

type NotificationRow = typeof notifications.$inferSelect;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    text: row.text,
    read: row.read,
    entityType: row.entityType,
    entityId: row.entityId,
    actorName: row.actorName,
    actorInitials: row.actorInitials,
    createdAt: row.createdAt.toISOString(),
  };
}

// Best-effort: a notification must never fail the originating action. Returns the
// created notification (so the caller can push it over the socket) or null.
export async function createNotification(params: {
  orgId: string;
  userId: string;
  type: string;
  text: string;
  entityType?: string | null;
  entityId?: string | null;
  actorName?: string | null;
}): Promise<Notification | null> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({
        organizationId: params.orgId,
        userId: params.userId,
        type: params.type,
        text: params.text,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        actorName: params.actorName ?? null,
        actorInitials: params.actorName ? initialsOf(params.actorName) : null,
      })
      .returning();
    return row ? toNotification(row) : null;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}

export async function listNotifications(
  orgId: string,
  userId: string,
  limit = 30,
): Promise<{ notifications: Notification[]; unread: number }> {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, orgId),
        eq(notifications.userId, userId),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const unread = rows.filter((r) => !r.read).length;
  return { notifications: rows.map(toNotification), unread };
}

export async function markRead(
  orgId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const updated = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.organizationId, orgId),
        eq(notifications.userId, userId),
      ),
    )
    .returning({ id: notifications.id });
  return updated.length > 0;
}

export async function markAllRead(
  orgId: string,
  userId: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.organizationId, orgId),
        eq(notifications.userId, userId),
        eq(notifications.read, false),
      ),
    );
}
