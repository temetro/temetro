// Canonical messaging shapes returned by the API / emitted over Socket.io.
// Mirrors the frontend `lib/messages.ts`.
export type Participant = {
  id: string;
  name: string;
};

// A shared appointment is stored as a snapshot so the card renders without an
// extra fetch and survives the appointment later being changed/deleted.
export type AppointmentSnapshot = {
  fileNumber: string;
  name: string;
  date: string;
  time: string;
  type: string;
  provider: string;
  status: string;
};

export type MessageAttachment =
  | {
      kind: "file";
      attachmentId: string;
      fileName: string;
      mimeType: string;
      size: number;
    }
  | { kind: "appointment"; appointment: AppointmentSnapshot }
  // A system-generated alert (e.g. an employee asked for a password reset but no
  // email provider is configured). Rendered as a distinct "System" card that
  // deep-links an admin to the member's settings.
  | {
      kind: "passwordReset";
      userId: string;
      userName: string;
      userEmail: string;
    };

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  attachments?: MessageAttachment[] | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  name: string; // display name: group name, or the other participant for a DM
  isGroup: boolean;
  isSystem: boolean; // a one-way System notice (no replies / calls)
  participants: Participant[];
  lastMessage: ConversationMessage | null;
  unread: boolean;
  // Messages from others newer than the caller's read pointer.
  unreadCount: number;
  updatedAt: string;
};
