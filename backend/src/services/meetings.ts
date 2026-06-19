import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { user } from "../db/schema/auth.js";
import { meetingRooms, scheduledMeetings } from "../db/schema/meetings.js";

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

// --- Scheduled meetings (calendar) -----------------------------------------

export type ScheduledMeeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  participants: string[];
  participantNames: string[];
  createdBy: string | null;
};

// Meetings the user is part of (creator or invited participant), with the
// participants' display names resolved for the calendar.
export async function listMeetingEvents(
  orgId: string,
  userId: string,
): Promise<ScheduledMeeting[]> {
  const rows = await db
    .select()
    .from(scheduledMeetings)
    .where(
      and(
        eq(scheduledMeetings.organizationId, orgId),
        or(
          eq(scheduledMeetings.createdBy, userId),
          // `participants` is a JSONB array of user ids.
          sql`${scheduledMeetings.participants} @> ${JSON.stringify([userId])}::jsonb`,
        ),
      ),
    )
    .orderBy(asc(scheduledMeetings.date), asc(scheduledMeetings.time));

  // Resolve participant names in one query.
  const ids = [...new Set(rows.flatMap((r) => r.participants))];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const users = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, ids));
    for (const u of users) nameById.set(u.id, u.name);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    time: r.time,
    participants: r.participants,
    participantNames: r.participants.map((id) => nameById.get(id) ?? "—"),
    createdBy: r.createdBy,
  }));
}

export async function createMeetingEvent(
  orgId: string,
  createdBy: string,
  input: { title: string; date: string; time: string; participants: string[] },
): Promise<ScheduledMeeting> {
  // The creator is always a participant.
  const participants = [...new Set([createdBy, ...input.participants])];
  const [row] = await db
    .insert(scheduledMeetings)
    .values({
      organizationId: orgId,
      title: input.title,
      date: input.date,
      time: input.time,
      participants,
      createdBy,
    })
    .returning({ id: scheduledMeetings.id });
  const events = await listMeetingEvents(orgId, createdBy);
  return events.find((e) => e.id === row!.id)!;
}

export async function deleteMeetingEvent(
  orgId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  // Only the creator can delete.
  const deleted = await db
    .delete(scheduledMeetings)
    .where(
      and(
        eq(scheduledMeetings.organizationId, orgId),
        eq(scheduledMeetings.id, id),
        eq(scheduledMeetings.createdBy, userId),
      ),
    )
    .returning({ id: scheduledMeetings.id });
  return deleted.length > 0;
}
