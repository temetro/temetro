import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { notes } from "../db/schema/notes.js";
import type { NoteInput } from "../lib/note-validation.js";
import type { Note } from "../types/note.js";

type NoteRow = typeof notes.$inferSelect;

// Postgres throws on a malformed uuid; treat non-uuid ids as "not found".
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listNotes(
  orgId: string,
  authorId: string,
): Promise<Note[]> {
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.organizationId, orgId), eq(notes.authorId, authorId)))
    .orderBy(desc(notes.updatedAt));
  return rows.map(toNote);
}

export async function getNote(
  orgId: string,
  authorId: string,
  id: string,
): Promise<Note | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.id, id),
        eq(notes.organizationId, orgId),
        eq(notes.authorId, authorId),
      ),
    );
  return row ? toNote(row) : null;
}

export async function createNote(
  orgId: string,
  authorId: string,
  input: NoteInput,
): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({
      organizationId: orgId,
      authorId,
      title: input.title,
      content: input.content,
    })
    .returning();
  return toNote(row!);
}

export async function updateNote(
  orgId: string,
  authorId: string,
  id: string,
  input: NoteInput,
): Promise<Note | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .update(notes)
    .set({ title: input.title, content: input.content })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.organizationId, orgId),
        eq(notes.authorId, authorId),
      ),
    )
    .returning();
  return row ? toNote(row) : null;
}

export async function deleteNote(
  orgId: string,
  authorId: string,
  id: string,
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const deleted = await db
    .delete(notes)
    .where(
      and(
        eq(notes.id, id),
        eq(notes.organizationId, orgId),
        eq(notes.authorId, authorId),
      ),
    )
    .returning({ id: notes.id });
  return deleted.length > 0;
}
