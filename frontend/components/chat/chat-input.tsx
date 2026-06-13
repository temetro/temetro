"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, Mic, Plus, Square, UserPlus, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { ModelPicker } from "@/components/chat/model-picker";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import type { Effort } from "@/lib/ai-models";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSubmit: (text: string) => void;
  status: ChatStatus;
  onStop?: () => void;
  model: string;
  effort: Effort;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: Effort) => void;
};

const iconButton =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const pillButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const contextPill =
  "flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

export function ChatInput({
  onSubmit,
  status,
  onStop,
  model,
  effort,
  onModelChange,
  onEffortChange,
}: ChatInputProps) {
  const { t } = useTranslation();

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  // Bumped on each open so the dialog remounts with a fresh file number + form.
  const [addKey, setAddKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating = status === "submitted" || status === "streaming";
  const canSend =
    (value.trim().length > 0 || files.length > 0) && !isGenerating;

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || isGenerating) {
      return;
    }
    const parts: string[] = [];
    if (trimmed) {
      parts.push(trimmed);
    }
    // Include the text of attached files so the agent can parse them (e.g. a
    // database export to import). Read text-like files; cap each so a huge file
    // can't blow the context. Binary files are referenced by name only.
    for (const file of files) {
      const textLike =
        /\.(csv|tsv|json|txt|md|xml|ndjson|tab)$/i.test(file.name) ||
        file.type.startsWith("text/") ||
        file.type === "application/json";
      if (textLike) {
        try {
          const content = (await file.text()).slice(0, 200_000);
          parts.push(`--- File: ${file.name} ---\n${content}`);
        } catch {
          parts.push(`[Attached: ${file.name}]`);
        }
      } else {
        parts.push(`[Attached: ${file.name}]`);
      }
    }
    onSubmit(parts.join("\n\n"));
    setValue("");
    setFiles([]);
  }, [value, files, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const handleFilesSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files;
      if (selected && selected.length > 0) {
        setFiles((prev) => [...prev, ...Array.from(selected)]);
      }
      // Reset so picking the same file again still fires onChange.
      event.target.value = "";
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <>
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full overflow-hidden rounded-[28px] border border-border bg-input shadow-sm"
    >
      {/* Textarea + toolbar, filling the rounded card. */}
      <div className="bg-input">
        <textarea
          aria-label={t("chat.input.message")}
          className="field-sizing-content block max-h-48 min-h-16 w-full resize-none bg-transparent px-5 pt-5 pb-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.input.placeholder")}
          rows={1}
          value={value}
        />

        {files.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            {files.map((file, index) => (
              <span
                className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-foreground"
                key={`${file.name}-${file.size}-${index}`}
              >
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  aria-label={t("chat.input.removeFile", { name: file.name })}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => removeFile(index)}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          aria-label={t("chat.input.attachFiles")}
          className="hidden"
          multiple
          onChange={handleFilesSelected}
          ref={fileInputRef}
          type="file"
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-1">
            <button
              aria-label={t("chat.input.attachFile")}
              className={iconButton}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Plus className="size-[18px]" />
            </button>
            <button
              className={cn(contextPill, "ml-0.5")}
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
              type="button"
            >
              <UserPlus className="size-4" />
              <span>{t("chat.input.addPatient")}</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ModelPicker
              effort={effort}
              model={model}
              onEffortChange={onEffortChange}
              onModelChange={onModelChange}
              triggerClassName={cn(pillButton, "mr-1")}
            />
            <button
              aria-label={t("chat.input.dictate")}
              className={iconButton}
              type="button"
            >
              <Mic className="size-[18px]" />
            </button>
            <button
              aria-label={isGenerating ? t("chat.input.stop") : t("chat.input.send")}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                canSend || isGenerating
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
              disabled={!(canSend || isGenerating)}
              onClick={isGenerating && onStop ? onStop : undefined}
              type={isGenerating && onStop ? "button" : "submit"}
            >
              {isGenerating ? (
                <Square className="size-3.5" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>

    <PatientFormDialog
      key={addKey}
      mode="create"
      onCreated={(fileNumber) => onSubmit(`/patient ${fileNumber}`)}
      onOpenChange={setAddOpen}
      open={addOpen}
    />
    </>
  );
}
