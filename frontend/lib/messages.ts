import { apiFetch } from "@/lib/api-client";

// Messaging shapes. Mirror the backend `src/types/messaging.ts`.
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
  name: string;
  isGroup: boolean;
  participants: Participant[];
  lastMessage: ConversationMessage | null;
  unread: boolean;
  updatedAt: string;
};

export function listConversations(): Promise<ConversationSummary[]> {
  return apiFetch<ConversationSummary[]>("/api/conversations");
}

export function listClinicMembers(): Promise<Participant[]> {
  return apiFetch<Participant[]>("/api/conversations/members");
}

export function createConversation(input: {
  participantIds: string[];
  name?: string | null;
}): Promise<ConversationSummary> {
  return apiFetch<ConversationSummary>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  return apiFetch<ConversationMessage[]>(
    `/api/conversations/${conversationId}/messages`,
  );
}

// REST fallback for sending (the realtime path is the socket "message:send").
export function sendMessageRest(
  conversationId: string,
  body: string,
): Promise<ConversationMessage> {
  return apiFetch<ConversationMessage>(
    `/api/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

export function markConversationRead(conversationId: string): Promise<void> {
  return apiFetch<void>(`/api/conversations/${conversationId}/read`, {
    method: "POST",
  });
}
