import { apiFetch } from "@/lib/api-client";

// A doctor's note. `content` is rich-text editor HTML. Mirrors the backend
// `src/types/note.ts`. Notes are scoped to the active clinic + signed-in author.
export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteInput = { title: string; content: string };

export function listNotes(): Promise<Note[]> {
  return apiFetch<Note[]>("/api/notes");
}

export function getNote(id: string): Promise<Note> {
  return apiFetch<Note>(`/api/notes/${id}`);
}

export function createNote(input: NoteInput): Promise<Note> {
  return apiFetch<Note>("/api/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNote(id: string, input: NoteInput): Promise<Note> {
  return apiFetch<Note>(`/api/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteNote(id: string): Promise<void> {
  return apiFetch<void>(`/api/notes/${id}`, { method: "DELETE" });
}
