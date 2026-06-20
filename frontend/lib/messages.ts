import { API_BASE_URL, apiFetch } from "@/lib/api-client";

// Messaging shapes. Mirror the backend `src/types/messaging.ts`.
export type Participant = {
  id: string;
  name: string;
};

// A shared appointment is stored as a snapshot (renders without a refetch and
// survives the appointment changing/being deleted).
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
  name: string;
  isGroup: boolean;
  isSystem: boolean;
  participants: Participant[];
  lastMessage: ConversationMessage | null;
  unread: boolean;
  // Messages from others newer than the caller's read pointer.
  unreadCount: number;
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
  attachments?: MessageAttachment[],
): Promise<ConversationMessage> {
  return apiFetch<ConversationMessage>(
    `/api/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify({ body, attachments }) },
  );
}

// Upload a file and get back a file attachment ready to send with a message.
export async function uploadAttachment(
  file: File,
): Promise<Extract<MessageAttachment, { kind: "file" }>> {
  const data = await fileToBase64(file);
  const meta = await apiFetch<{
    attachmentId: string;
    fileName: string;
    mimeType: string;
    size: number;
  }>("/api/conversations/attachments", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data,
    }),
  });
  return { kind: "file", ...meta };
}

// Fetch an attachment with credentials and trigger a browser download. (A plain
// link wouldn't carry the auth cookie cross-origin.)
export async function downloadAttachment(
  attachmentId: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/api/conversations/attachments/${attachmentId}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Read a File as raw base64 (without the `data:...;base64,` prefix).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function markConversationRead(conversationId: string): Promise<void> {
  return apiFetch<void>(`/api/conversations/${conversationId}/read`, {
    method: "POST",
  });
}
