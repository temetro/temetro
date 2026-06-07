// The canonical Note shape returned by the API. Mirrors the frontend
// `lib/notes.ts` Note type. `content` is rich-text editor HTML.
export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};
