"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Save,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { type ReactNode, useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import type { Note } from "@/lib/notes";

function FormatButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <ToolbarButton
      // Keep the editor selection while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      render={
        <Button
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          size="icon-sm"
          type="button"
          variant={active ? "secondary" : "ghost"}
        />
      }
    >
      {children}
    </ToolbarButton>
  );
}

// Word-like rich-text editor for a single note: a COSS Toolbar driving Tiptap
// commands, a title field, and Save / Delete. Remount (via a `key` on the
// parent) to load a different note.
export function NotesEditor({
  note,
  saving,
  onSave,
  onDelete,
}: {
  note: Note;
  saving: boolean;
  onSave: (data: { title: string; content: string }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Force a re-render on every editor transaction so the toolbar reflects the
  // current formatting/undo state.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const editor = useEditor({
    content: note.content,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your note…" }),
    ],
    // Required under Next's SSR to avoid a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // `note-content` styles headings/lists/etc. (see globals.css); padding +
        // min-h-full make the whole card a click target, text anchored top-left.
        class: "note-content min-h-full p-4 focus:outline-none",
      },
    },
    onTransaction: bump,
  });

  if (!editor) return null;

  const save = () =>
    onSave({
      title: title.trim() || "Untitled note",
      content: editor.getHTML(),
    });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          className="font-medium text-base"
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          value={title}
        />
        {onDelete && (
          <Button
            aria-label="Delete note"
            onClick={() => setConfirmOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        )}
        <Button disabled={saving} onClick={save} type="button">
          <Save className="size-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Toolbar className="w-fit max-w-full self-start overflow-x-auto">
        <ToolbarGroup>
          <FormatButton
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </FormatButton>
          <FormatButton
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </FormatButton>
          <FormatButton
            active={editor.isActive("underline")}
            label="Underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </FormatButton>
        </ToolbarGroup>
        <ToolbarSeparator orientation="vertical" />
        <ToolbarGroup>
          <FormatButton
            active={editor.isActive("heading", { level: 1 })}
            label="Heading 1"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 />
          </FormatButton>
          <FormatButton
            active={editor.isActive("heading", { level: 2 })}
            label="Heading 2"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 />
          </FormatButton>
        </ToolbarGroup>
        <ToolbarSeparator orientation="vertical" />
        <ToolbarGroup>
          <FormatButton
            active={editor.isActive("bulletList")}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </FormatButton>
          <FormatButton
            active={editor.isActive("orderedList")}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </FormatButton>
        </ToolbarGroup>
        <ToolbarSeparator orientation="vertical" />
        <ToolbarGroup>
          <FormatButton
            disabled={!editor.can().undo()}
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 />
          </FormatButton>
          <FormatButton
            disabled={!editor.can().redo()}
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 />
          </FormatButton>
        </ToolbarGroup>
      </Toolbar>

      <div className="min-h-0 flex-1 cursor-text overflow-y-auto rounded-2xl border bg-card/30">
        <EditorContent className="h-full" editor={editor} />
      </div>

      {onDelete && (
        <ConfirmDialog
          confirmLabel="Delete note"
          description={`"${title.trim() || "Untitled note"}" will be permanently deleted. This can't be undone.`}
          onConfirm={onDelete}
          onOpenChange={setConfirmOpen}
          open={confirmOpen}
          title="Delete this note?"
        />
      )}
    </div>
  );
}
