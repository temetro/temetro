"use client";

import { NotesEditor } from "@/components/notes/notes-editor";
import {
  Sheet,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Note } from "@/lib/notes";

// Right-side Sheet that holds the rich-text NotesEditor, opened from the Notes
// list (mirrors the Patients table → side Sheet pattern). The save/delete logic
// stays in NotesView and is passed down. `editorKey` remounts the editor when a
// different note (or a fresh draft) is opened.
export function NoteDetailSheet({
  note,
  editorKey,
  open,
  onOpenChange,
  saving,
  onSave,
  onDelete,
}: {
  note: Note | null;
  editorKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (data: { title: string; content: string }) => void;
  onDelete?: () => void;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-2xl" side="right">
        <SheetHeader>
          <SheetTitle>{note?.id ? "Edit note" : "New note"}</SheetTitle>
        </SheetHeader>
        {/* Plain flex container (not SheetPanel) so the editor gets a bounded
            height and scrolls internally rather than nesting two scroll areas. */}
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-1 pb-6">
          {note && (
            <NotesEditor
              key={editorKey}
              note={note}
              onDelete={onDelete}
              onSave={onSave}
              saving={saving}
            />
          )}
        </div>
      </SheetPopup>
    </Sheet>
  );
}
