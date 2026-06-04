"use client";

import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { NotesEditor } from "@/components/notes/notes-editor";
import { Button } from "@/components/ui/button";
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
  const [selected, setSelected] = useState<Note | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listNotes()
      .then((data) => {
        if (!active) return;
        setNotes(data);
        setSelected((current) => current ?? data[0] ?? null);
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
      setSelected(list[0] ?? null);
      notify.success("Note deleted");
    } catch (err) {
      notify.error(
        "Couldn't delete note",
        err instanceof Error ? err.message : "Please try again.",
      );
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl gap-6 px-6 py-8">
      <aside className="flex w-60 shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg tracking-tight">Notes</h1>
          <Button onClick={startNew} size="sm" type="button">
            <Plus className="size-4" />
            New
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
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
                  "flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent",
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

      <div className="min-w-0 flex-1">
        {selected ? (
          <NotesEditor
            key={selected.id || `draft-${draftKey}`}
            note={selected}
            onDelete={selected.id ? () => remove(selected.id) : undefined}
            onSave={save}
            saving={saving}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="size-8" />
            <p className="text-sm">Select a note or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
