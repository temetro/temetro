import { apiFetch } from "@/lib/api-client";

// A persistent staff meeting room (Discord-style voice/video channel). The live
// call (participants/media) is ephemeral and runs over the socket; this is just
// the room list.
export type MeetingRoom = {
  id: string;
  name: string;
  createdAt: string;
};

export function listMeetingRooms(): Promise<MeetingRoom[]> {
  return apiFetch<MeetingRoom[]>("/api/meetings");
}

export function createMeetingRoom(name: string): Promise<MeetingRoom> {
  return apiFetch<MeetingRoom>("/api/meetings", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteMeetingRoom(id: string): Promise<void> {
  return apiFetch<void>(`/api/meetings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Max peers in a mesh call — mirrors the backend cap (mesh degrades past ~4).
export const MAX_CALL_PEERS = 4;

// A remote peer in a live call.
export type CallPeer = {
  socketId: string;
  userId: string;
  userName: string;
};
