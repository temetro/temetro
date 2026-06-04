"use client";

import { NotebookPen, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { NotesEditor } from "@/components/notes/notes-editor";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  createNote,
  deleteNote,
  listNotes,
  type Note,
  updateNote,
} from "@/lib/notes";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

const newDraft = (): Note => ({
  id: "",
  title: "",
  content: "",
  createdAt: "",
  updatedAt: "",
});

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  // No auto-selection: with nothing chosen the right pane shows the Empty state.
  const [selected, setSelected] = useState<Note | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listNotes()
      .then((data) => {
        if (active) setNotes(data);
      })
      .catch((err) => {
        if (active) {
          notify.error(
            "Couldn't load notes",
            err instanceof Error ? err.message : "Please try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startNew = () => {
    setSelected(newDraft());
    setDraftKey((k) => k + 1);
  };

  const save = async (data: { title: string; content: string }) => {
    setSaving(true);
    try {
      const saved = selected?.id
        ? await updateNote(selected.id, data)
        : await createNote(data);
      const list = await listNotes();
      setNotes(list);
      setSelected(list.find((n) => n.id === saved.id) ?? saved);
      notify.success("Note saved");
    } catch (err) {
      notify.error(
        "Couldn't save note",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNote(id);
      const list = await listNotes();
      setNotes(list);
      setSelected(null);
      notify.success("Note deleted");
    } catch (err) {
      notify.error(
        "Couldn't delete note",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: note list */}
      <aside className="flex w-72 shrink-0 flex-col border-border border-r">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">Notes</h1>
          <Button
            aria-label="New note"
            onClick={startNew}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              No notes yet.
            </p>
          ) : (
            notes.map((n) => (
              <button
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
                  selected?.id === n.id && "bg-accent",
                )}
                key={n.id}
                onClick={() => setSelected(n)}
                type="button"
              >
                <span className="w-full truncate font-medium text-foreground text-sm">
                  {n.title || "Untitled note"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(n.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: editor or empty state */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected ? (
          <div className="flex h-full flex-col p-6">
            <NotesEditor
              key={selected.id || `draft-${draftKey}`}
              note={selected}
              onDelete={selected.id ? () => remove(selected.id) : undefined}
              onSave={save}
              saving={saving}
            />
          </div>
        ) : (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <NotebookPen />
              </EmptyMedia>
              <EmptyTitle>No note selected</EmptyTitle>
              <EmptyDescription>
                Select a note from the list, or create a new one to start
                writing.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={startNew} type="button">
                <Plus className="size-4" />
                New note
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  );
}
