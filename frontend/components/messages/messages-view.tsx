"use client";

import { Mail, SendHorizonal } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

// All messages here are mock/placeholder data — there is no messaging backend.
// They illustrate the email-style inbox layout (left list, right reading pane).

type Message = {
  id: string;
  sender: string;
  initials: string;
  subject: string;
  preview: string;
  body: string[];
  time: string;
  read: boolean;
};

const seed: Message[] = [
  {
    id: "1",
    sender: "Dr. Stein",
    initials: "DS",
    subject: "Lab results ready",
    preview: "The lab results for Amina Yusuf are now available…",
    body: [
      "Hi,",
      "The lab results for Amina Yusuf (file #10293) are now available for your review. The lipid panel and HbA1c both came back within the expected range.",
      "Let me know if you'd like to adjust her current plan before the follow-up.",
      "— Dr. Stein",
    ],
    time: "10:24",
    read: false,
  },
  {
    id: "2",
    sender: "Dr. Okafor",
    initials: "DO",
    subject: "Re: Daniel Mensah intake",
    preview: "Thanks for sending the intake notes over. I've…",
    body: [
      "Thanks for sending the intake notes over.",
      "I've added him to tomorrow's schedule at 10:00. Could you confirm whether his prior records were imported?",
      "— Dr. Okafor",
    ],
    time: "09:12",
    read: false,
  },
  {
    id: "3",
    sender: "Care team",
    initials: "CT",
    subject: "Vaccination stock update",
    preview: "A reminder that the seasonal vaccine stock has…",
    body: [
      "A reminder that the seasonal vaccine stock has been replenished.",
      "Slots are open across the week — please direct eligible patients to the front desk to book.",
    ],
    time: "Yesterday",
    read: true,
  },
  {
    id: "4",
    sender: "Reception",
    initials: "RC",
    subject: "Schedule change for Friday",
    preview: "Two afternoon appointments were rescheduled…",
    body: [
      "Two afternoon appointments on Friday were rescheduled to next Monday at the patients' request.",
      "The updated times are reflected in the schedule.",
    ],
    time: "Mon",
    read: true,
  },
];

export function MessagesView() {
  const [messages, setMessages] = useState<Message[]>(seed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const open = (id: string) => {
    setSelectedId(id);
    setReply("");
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m)),
    );
  };

  const send = () => {
    if (!(reply.trim() && selected)) return;
    notify.success("Reply sent", `To ${selected.sender}`);
    setReply("");
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* Left: inbox list */}
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">Inbox</h1>
          <span className="text-muted-foreground text-xs">
            {messages.filter((m) => !m.read).length} unread
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {messages.map((m) => (
            <button
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent",
                selected?.id === m.id && "bg-accent",
              )}
              key={m.id}
              onClick={() => open(m.id)}
              type="button"
            >
              <div className="flex w-full items-center gap-2">
                {!m.read && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    m.read
                      ? "font-medium text-foreground"
                      : "font-semibold text-foreground",
                  )}
                >
                  {m.sender}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {m.time}
                </span>
              </div>
              <span className="w-full truncate text-foreground text-sm">
                {m.subject}
              </span>
              <span className="w-full truncate text-muted-foreground text-xs">
                {m.preview}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Right: reading pane or empty state */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {selected ? (
          <div className="flex h-full flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border bg-card/30 p-4">
              <h2 className="font-semibold text-foreground text-lg tracking-tight">
                {selected.subject}
              </h2>
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>{selected.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground text-sm">
                    {selected.sender}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    to me · {selected.time}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card/30 p-4">
              <div className="flex flex-col gap-3 text-foreground text-sm leading-relaxed">
                {selected.body.map((para) => (
                  <p key={para}>{para}</p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border bg-card/30 p-3">
              <Textarea
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply to ${selected.sender}…`}
                size="sm"
                value={reply}
              />
              <div className="flex justify-end">
                <Button disabled={!reply.trim()} onClick={send} type="button">
                  <SendHorizonal className="size-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border bg-card/30">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Mail />
                </EmptyMedia>
                <EmptyTitle>No message selected</EmptyTitle>
                <EmptyDescription>
                  Choose a message from the inbox to read it here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}
