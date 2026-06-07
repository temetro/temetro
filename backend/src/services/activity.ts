import { desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { activityLog } from "../db/schema/activity.js";
import type { ActivityEntityType, ActivityEntry } from "../types/activity.js";

type ActivityRow = typeof activityLog.$inferSelect;

// Up to two-letter initials from a display name (e.g. "Dr. Ada Okafor" -> "AO").
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

function toEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    actorName: row.actorName,
    actorInitials: initialsOf(row.actorName),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    patientName: row.patientName,
    patientFileNumber: row.patientFileNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

// Best-effort: an audit entry must never fail the originating request.
export async function recordActivity(params: {
  orgId: string;
  actor: { id?: string | null; name?: string | null };
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  patientName?: string | null;
  patientFileNumber?: string | null;
}): Promise<void> {
  try {
    await db.insert(activityLog).values({
      organizationId: params.orgId,
      actorId: params.actor.id ?? null,
      actorName: params.actor.name?.trim() || "Someone",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      patientName: params.patientName ?? null,
      patientFileNumber: params.patientFileNumber ?? null,
    });
  } catch (err) {
    console.error("Failed to record activity:", err);
  }
}

export async function listActivity(
  orgId: string,
  limit = 100,
): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.organizationId, orgId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  return rows.map(toEntry);
}
