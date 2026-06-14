import type { TemetroUIMessage } from "@/lib/ai-chat";
import { apiFetch } from "@/lib/api-client";

// Persisted AI-chat threads (Claude-style history). Threads are per-user within
// the active clinic; the thread id is generated on the client.
export type ThreadSummary = { id: string; title: string; updatedAt: string };

type StoredMessage = { role: string; parts: unknown };

export function listThreads(): Promise<ThreadSummary[]> {
  return apiFetch<ThreadSummary[]>("/api/chat/threads");
}

export function getThread(
  id: string,
): Promise<{ id: string; title: string; messages: StoredMessage[] }> {
  return apiFetch(`/api/chat/threads/${id}`);
}

export function saveThread(
  id: string,
  messages: TemetroUIMessage[],
  title: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/chat/threads/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, parts: m.parts })),
      title,
    }),
  });
}

export function deleteThread(id: string): Promise<void> {
  return apiFetch<void>(`/api/chat/threads/${id}`, { method: "DELETE" });
}

// Fired after a thread is saved/deleted so the sidebar history can refresh.
export const THREADS_CHANGED_EVENT = "temetro:threads-changed";
export function notifyThreadsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THREADS_CHANGED_EVENT));
  }
}
