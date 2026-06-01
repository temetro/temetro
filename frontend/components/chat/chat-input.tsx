"use client";

import type { ChatStatus } from "ai";
import {
  ArrowUp,
  Building2,
  CalendarRange,
  ChevronDown,
  Hand,
  Mic,
  Plus,
  Square,
  Stethoscope,
} from "lucide-react";
import { type KeyboardEvent, useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSubmit: (text: string) => void;
  status: ChatStatus;
  onStop?: () => void;
};

const iconButton =
  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const pillButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const contextPill =
  "flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground";

export function ChatInput({ onSubmit, status, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const isGenerating = status === "submitted" || status === "streaming";
  const canSend = value.trim().length > 0 && !isGenerating;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) {
      return;
    }
    onSubmit(trimmed);
    setValue("");
  }, [value, isGenerating, onSubmit]);

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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="w-full overflow-hidden rounded-[28px] border border-border/60 bg-[oklch(0.172_0.006_277)] shadow-sm"
    >
      {/* Top (lighter) card: textarea + toolbar, with a slightly smaller bottom radius */}
      <div className="rounded-b-[22px] bg-card">
        <textarea
          aria-label="Message"
          className="field-sizing-content block max-h-48 min-h-16 w-full resize-none bg-transparent px-5 pt-5 pb-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Look up a patient — try /patient 10293"
          rows={1}
          value={value}
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-1">
            <button aria-label="Attach file" className={iconButton} type="button">
              <Plus className="size-[18px]" />
            </button>
            <button className={pillButton} type="button">
              <Hand className="size-4" />
              <span className="truncate">Standard access</span>
              <ChevronDown className="size-4 opacity-70" />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button className={cn(pillButton, "mr-1")} type="button">
              <span className="font-medium text-foreground">Clinical</span>
              <span>Detailed</span>
              <ChevronDown className="size-4 opacity-70" />
            </button>
            <button aria-label="Dictate" className={iconButton} type="button">
              <Mic className="size-[18px]" />
            </button>
            <button
              aria-label={isGenerating ? "Stop" : "Send"}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                canSend || isGenerating
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted-foreground/30 text-foreground/70"
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

      {/* Bottom (darker) card peeking out below, more rounded: context selectors */}
      <div className="flex flex-wrap items-center gap-1 px-3 pt-2.5 pb-3">
        <button className={contextPill} type="button">
          <Stethoscope className="size-4" />
          <span>Internal Medicine</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
        <button className={contextPill} type="button">
          <Building2 className="size-4" />
          <span>Main Hospital</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
        <button className={contextPill} type="button">
          <CalendarRange className="size-4" />
          <span>Last 12 months</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      </div>
    </form>
  );
}
