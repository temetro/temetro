import type React from "react";

import { cn } from "@/lib/utils";

// COSS "Frame" primitive (coss.com/ui/docs/components/frame). A Frame is a muted
// tray that holds one or more FramePanels; multiple panels are "Separated
// Panels" — spaced apart with `mt-1` by default (via the adjacent-sibling
// selector below), each a self-contained bordered card. This is the opposite of
// `CardFrame` in card.tsx, which fuses its cards into one flush surface.

export function Frame({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-muted/72 p-1",
        "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className,
      )}
      data-slot="frame"
      {...props}
    />
  );
}

export function FramePanel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative rounded-xl border bg-background bg-clip-padding p-5 shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      data-slot="frame-panel"
      {...props}
    />
  );
}

export function FrameHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("flex flex-col px-5 py-4", className)}
      data-slot="frame-header"
      {...props}
    />
  );
}

export function FrameTitle({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("font-semibold text-sm", className)}
      data-slot="frame-title"
      {...props}
    />
  );
}

export function FrameDescription({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="frame-description"
      {...props}
    />
  );
}

export function FrameFooter({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("px-5 py-4", className)}
      data-slot="frame-footer"
      {...props}
    />
  );
}
