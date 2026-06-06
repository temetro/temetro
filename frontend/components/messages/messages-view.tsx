"use client";

import { Mail, SendHorizonal } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// All conversations here are mock/placeholder data — there is no messaging
// backend. They illustrate the inbox + chat-thread timeline layout.

type ChatMessage = {
  id: string;
  direction: "in" | "out";
  text: string;
  time: string;
};

type Conversation = {
  id: string;
  name: string;
  initials: string;
  role: string;
  unread: boolean;
  messages: ChatMessage[];
};

const seed: Conversation[] = [
  {
    id: "1",
    name: "Dr. Stein",
    initials: "DS",
    role: "Endocrinology",
    unread: true,
    messages: [
      {
        id: "1a",
        direction: "in",
        text: "The lab results for Amina Yusuf are back — lipid panel and HbA1c are both in range.",
        time: "10:24",
      },
      {
        id: "1b",
        direction: "in",
        text: "Want me to adjust her plan before the follow-up?",
        time: "10:25",
      },
    ],
  },
  {
    id: "2",
    name: "Dr. Okafor",
    initials: "DO",
    role: "Family medicine",
    unread: true,
    messages: [
      {
        id: "2a",
        direction: "out",
        text: "Sent over Daniel Mensah's intake notes — can you take a look?",
        time: "08:50",
      },
      {
        id: "2b",
        direction: "in",
        text: "Thanks! Added him to tomorrow at 10:00. Were his prior records imported?",
        time: "09:12",
      },
    ],
  },
  {
    id: "3",
    name: "Care team",
    initials: "CT",
    role: "Clinic-wide",
    unread: false,
    messages: [
      {
        id: "3a",
        direction: "in",
        text: "Seasonal vaccine stock has been replenished — slots are open all week.",
        time: "Yesterday",
      },
      {
        id: "3b",
        direction: "out",
        text: "Great, I'll direct eligible patients to the front desk.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "4",
    name: "Reception",
    initials: "RC",
    role: "Front desk",
    unread: false,
    messages: [
      {
        id: "4a",
        direction: "in",
        text: "Two Friday afternoon appointments were moved to next Monday at the patients' request.",
        time: "Mon",
      },
    ],
  },
];

const now = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function MessagesView() {
  const [conversations, setConversations] = useState<Conversation[]>(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");

  const unreadCount = conversations.filter((c) => c.unread).length;
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const visible = useMemo(
    () => (showUnreadOnly ? conversations.filter((c) => c.unread) : conversations),
    [conversations, showUnreadOnly],
  );

  const open = (id: string) => {
    setSelectedId(id);
    setDraft("");
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c)),
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!(text && selected)) return;
    const message: ChatMessage = {
      id: `${selected.id}-${Date.now()}`,
      direction: "out",
      text,
      time: now(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, messages: [...c.messages, message] }
          : c,
      ),
    );
    setDraft("");
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* Left: conversation list */}
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">Inbox</h1>
          <Button
            aria-pressed={showUnreadOnly}
            onClick={() => setShowUnreadOnly((v) => !v)}
            size="sm"
            type="button"
            variant={showUnreadOnly ? "secondary" : "ghost"}
          >
            Unread · {unreadCount}
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              No unread messages.
            </p>
          ) : (
            visible.map((c) => {
              const last = c.messages.at(-1);
              return (
                <button
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
                    selected?.id === c.id && "bg-accent",
                  )}
                  key={c.id}
                  onClick={() => open(c.id)}
                  type="button"
                >
                  <div className="flex w-full items-center gap-2">
                    {c.unread && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        c.unread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground",
                      )}
                    >
                      {c.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      {last?.time}
                    </span>
                  </div>
                  <span className="w-full truncate text-muted-foreground text-xs">
                    {last?.direction === "out" && "You: "}
                    {last?.text}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right: conversation timeline or empty state */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected ? (
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border bg-card/30 p-4">
              <Avatar className="size-9">
                <AvatarFallback>{selected.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground text-sm">
                  {selected.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {selected.role}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card/30 p-4">
              <div className="flex flex-col gap-3">
                {selected.messages.map((m) => (
                  <div
                    className={cn(
                      "flex flex-col gap-1",
                      m.direction === "out" ? "items-end" : "items-start",
                    )}
                    key={m.id}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                        m.direction === "out"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {m.text}
                    </div>
                    <span className="px-1 text-muted-foreground text-[11px]">
                      {m.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <form
              className="flex items-center gap-2 rounded-2xl border bg-card/30 p-2"
              onSubmit={send}
            >
              <Input
                aria-label="Message"
                className="border-0 bg-transparent shadow-none before:hidden"
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${selected.name}…`}
                value={draft}
              />
              <Button
                aria-label="Send"
                disabled={!draft.trim()}
                size="icon"
                type="submit"
              >
                <SendHorizonal className="size-4" />
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border bg-card/30">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Mail />
                </EmptyMedia>
                <EmptyTitle>No conversation selected</EmptyTitle>
                <EmptyDescription>
                  Choose a conversation from the inbox to read and reply.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}
