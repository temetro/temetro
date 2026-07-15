"use client";

import { NotebookPen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { NoteDetailSheet } from "@/components/notes/note-detail-sheet";
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

const newDraft = (): Note => ({
  id: "",
  title: "",
  content: "",
  createdAt: "",
  updatedAt: "",
});

export function NotesView() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  // The note shown in the editor Sheet; null when the Sheet is closed.
  const [selected, setSelected] = useState<Note | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
            t("notes.loadFailed"),
            err instanceof Error ? err.message : t("notes.tryAgain"),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // `t` intentionally omitted: it is only read to build a failure message,
    // and re-fetching on a language change would be pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = () => {
    setSelected(newDraft());
    setDraftKey((k) => k + 1);
    setSheetOpen(true);
  };

  const openNote = (note: Note) => {
    setSelected(note);
    setSheetOpen(true);
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
      notify.success(t("notes.saved"));
    } catch (err) {
      notify.error(
        t("notes.saveFailed"),
        err instanceof Error ? err.message : t("notes.tryAgain"),
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
      setSheetOpen(false);
      notify.success(t("notes.deleted"));
    } catch (err) {
      notify.error(
        t("notes.deleteFailed"),
        err instanceof Error ? err.message : t("notes.tryAgain"),
      );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("notes.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("notes.subtitle")}</p>
        </div>
        <Button className="rounded-3xl" onClick={startNew} type="button">
          <Plus className="size-4" />
          {t("notes.new")}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card/30 px-4 py-10 text-center text-muted-foreground text-sm">
          {t("notes.loading")}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border bg-card/30 py-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <NotebookPen />
              </EmptyMedia>
              <EmptyTitle>{t("notes.emptyTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("notes.emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={startNew} type="button">
                <Plus className="size-4" />
                {t("notes.new")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card/30">
          {notes.map((n) => (
            <button
              className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-start transition-colors hover:bg-accent/50"
              key={n.id}
              onClick={() => openNote(n)}
              type="button"
            >
              <span className="w-full truncate font-medium text-foreground text-sm">
                {n.title || t("notes.untitled")}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("notes.updated", {
                  date: new Date(n.updatedAt).toLocaleDateString(),
                })}
              </span>
            </button>
          ))}
        </div>
      )}

      <NoteDetailSheet
        editorKey={selected?.id || `draft-${draftKey}`}
        note={selected}
        onDelete={selected?.id ? () => remove(selected.id) : undefined}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelected(null);
        }}
        onSave={save}
        open={sheetOpen}
        saving={saving}
      />
    </div>
  );
}
