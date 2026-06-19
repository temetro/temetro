import { apiFetch } from "@/lib/api-client";

// A notification for the signed-in user. Mirrors the backend
// `src/types/notification.ts`.
export type Notification = {
  id: string;
  type: string;
  text: string;
  read: boolean;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  actorInitials: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: Notification[];
  unread: number;
};

export function listNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>("/api/notifications");
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/api/notifications/read-all", { method: "POST" });
}

// Maps a notification to the in-app route where the event occurred, so the
// popover can navigate the user there on click. Returns null when there's no
// meaningful destination (the item then renders as non-clickable).
export function notificationHref(n: Notification): string | null {
  if (!n.entityId) return null;
  switch (n.entityType) {
    case "conversation":
      return `/messages?conversation=${encodeURIComponent(n.entityId)}`;
    case "patient":
      return `/patients?file=${encodeURIComponent(n.entityId)}`;
    default:
      return null;
  }
}
