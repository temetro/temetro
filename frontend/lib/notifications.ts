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
