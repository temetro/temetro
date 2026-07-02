"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, Mic, Plus, Square, UserPlus, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { ModePicker } from "@/components/chat/mode-picker";
import { PatientFormDialog } from "@/components/chat/patient-form-dialog";
import type { ChatMode } from "@/lib/chat-modes";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSubmit: (text: string, files: File[]) => void;
  status: ChatStatus;
  onStop?: () => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
};

const iconButton =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

// Minimal Web Speech API typings — not in this TS lib.dom. We only use a slice.
interface SpeechRecognitionEventLike {
  readonly results: {
    readonly length: number;
    [index: number]: { readonly [index: number]: { transcript: string } };
  };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// Web Speech API lives under a vendor prefix in Chromium-based browsers and is
// absent in others (e.g. Firefox). Resolve the constructor or null.
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const pillButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const contextPill =
  "flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

export function ChatInput({
  onSubmit,
  status,
  onStop,
  mode,
  onModeChange,
}: ChatInputProps) {
  const { t } = useTranslation();

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  // Bumped on each open so the dialog remounts with a fresh file number + form.
  const [addKey, setAddKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice dictation (Web Speech API). Detected client-side so SSR markup and the
  // first client render agree (button starts disabled, enabled by the effect).
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // The textarea contents when dictation started; transcript is appended to it.
  const dictationBaseRef = useRef("");

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleDictation = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    // Continue from where the text leaves off, with a separating space.
    dictationBaseRef.current = value ? `${value.replace(/\s*$/, "")} ` : "";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setValue(dictationBaseRef.current + transcript);
    };
    const end = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = end;
    recognition.onerror = end;

    recognition.start();
    setIsListening(true);
  }, [isListening, value]);

  const isGenerating = status === "submitted" || status === "streaming";
  const canSend =
    (value.trim().length > 0 || files.length > 0) && !isGenerating;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    // Allow submitting while generating — the panel queues it (Claude-style).
    if (!trimmed && files.length === 0) {
      return;
    }
    // Hand the raw files to the panel; it sends them as proper attachment parts
    // (rendered as chips, not raw inlined text) and the backend extracts any
    // text-like content for the model.
    onSubmit(trimmed, files);
    setValue("");
    setFiles([]);
  }, [value, files, onSubmit]);

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
      // Copy the files out NOW: `event.target.files` is a live FileList, and the
      // `event.target.value = ""` reset below empties it. React runs the
      // functional setState updater during a later render, so reading the
      // FileList inside the updater would see it already cleared (no file added,
      // no chip). Snapshot to a plain array first.
      const picked = Array.from(event.target.files ?? []);
      // Reset so picking the same file again still fires onChange.
      event.target.value = "";
      if (picked.length > 0) {
        setFiles((prev) => [...prev, ...picked]);
      }
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
      className="w-full shrink-0 overflow-hidden rounded-[28px] border border-input bg-background shadow-sm transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/24 dark:bg-input/30"
    >
      {/* Textarea + toolbar, filling the rounded card. */}
      <div>
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

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-1">
            {/* The attach control is a real <label> wrapping the file input, so
                the browser opens the picker natively on click. A programmatic
                `inputRef.click()` gets dropped when the textarea is focused with
                text (the click blurs it first, losing the user-activation), which
                is why attaching failed while typing. A label has no such gate. */}
            <label
              aria-label={t("chat.input.attachFile")}
              className={cn(iconButton, "cursor-pointer")}
            >
              <Plus className="size-[18px]" />
              <input
                aria-label={t("chat.input.attachFiles")}
                className="sr-only"
                multiple
                onChange={handleFilesSelected}
                ref={fileInputRef}
                type="file"
              />
            </label>
            <button
              className={cn(contextPill, "ms-0.5")}
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
            <ModePicker
              mode={mode}
              onModeChange={onModeChange}
              triggerClassName={cn(pillButton, "me-1")}
            />
            <button
              aria-label={
                isListening ? t("chat.input.dictateStop") : t("chat.input.dictate")
              }
              aria-pressed={isListening}
              className={cn(
                iconButton,
                isListening &&
                  "animate-pulse bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
              )}
              disabled={!speechSupported}
              onClick={toggleDictation}
              title={
                speechSupported
                  ? t("chat.input.dictate")
                  : t("chat.input.dictateUnsupported")
              }
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
      onCreated={(fileNumber) => onSubmit(`/patient ${fileNumber}`, [])}
      onOpenChange={setAddOpen}
      open={addOpen}
    />
    </>
  );
}
