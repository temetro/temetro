// The canonical Notification shape returned by the API. Per-recipient, scoped to
// a clinic. Auto-created from events (new message, patient record change).
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
