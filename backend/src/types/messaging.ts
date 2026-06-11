// Canonical messaging shapes returned by the API / emitted over Socket.io.
// Mirrors the frontend `lib/messages.ts`.
export type Participant = {
  id: string;
  name: string;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  name: string; // display name: group name, or the other participant for a DM
  isGroup: boolean;
  participants: Participant[];
  lastMessage: ConversationMessage | null;
  unread: boolean;
  // Messages from others newer than the caller's read pointer.
  unreadCount: number;
  updatedAt: string;
};
