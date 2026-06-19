import { and, asc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { meetingRooms } from "../db/schema/meetings.js";

export type MeetingRoom = {
  id: string;
  name: string;
  createdAt: string;
};

export async function listRooms(orgId: string): Promise<MeetingRoom[]> {
  const rows = await db
    .select({
      id: meetingRooms.id,
      name: meetingRooms.name,
      createdAt: meetingRooms.createdAt,
    })
    .from(meetingRooms)
    .where(eq(meetingRooms.organizationId, orgId))
    .orderBy(asc(meetingRooms.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createRoom(
  orgId: string,
  name: string,
  createdBy: string,
): Promise<MeetingRoom> {
  const [row] = await db
    .insert(meetingRooms)
    .values({ organizationId: orgId, name, createdBy })
    .returning({
      id: meetingRooms.id,
      name: meetingRooms.name,
      createdAt: meetingRooms.createdAt,
    });
  return {
    id: row!.id,
    name: row!.name,
    createdAt: row!.createdAt.toISOString(),
  };
}

export async function deleteRoom(orgId: string, roomId: string): Promise<boolean> {
  const deleted = await db
    .delete(meetingRooms)
    .where(
      and(eq(meetingRooms.organizationId, orgId), eq(meetingRooms.id, roomId)),
    )
    .returning({ id: meetingRooms.id });
  return deleted.length > 0;
}

// Whether a room exists within the given clinic — used by the realtime layer to
// authorize a call:join before relaying any signaling.
export async function roomExists(orgId: string, roomId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: meetingRooms.id })
    .from(meetingRooms)
    .where(
      and(eq(meetingRooms.organizationId, orgId), eq(meetingRooms.id, roomId)),
    );
  return Boolean(row);
}
