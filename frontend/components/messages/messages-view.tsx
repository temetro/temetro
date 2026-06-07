"use client";

import { Mail, Plus, SendHorizonal } from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  type ConversationMessage,
  type ConversationSummary,
  type Participant,
  createConversation,
  getMessages,
  listClinicMembers,
  listConversations,
} from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Up to two-letter initials from a display name.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

// ISO timestamp -> "10:24" (24h).
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function MessagesView() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id ?? "";

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [members, setMembers] = useState<Participant[]>([]);

  // Refs so the socket handler (registered once) reads current values.
  const selectedIdRef = useRef<string | null>(null);
  const myIdRef = useRef<string>("");
  myIdRef.current = myId;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial conversation load.
  useEffect(() => {
    let active = true;
    listConversations()
      .then((data) => {
        if (active) setConversations(data);
      })
      .catch(() => {
        /* api-client redirects on 401 */
      });
    return () => {
      active = false;
    };
  }, []);

  // Realtime: append to the open thread and keep the inbox fresh.
  useEffect(() => {
    const socket = getSocket();
    const onMessageNew = (msg: ConversationMessage) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === msg.conversationId);
        if (!existing) {
          listConversations().then(setConversations).catch(() => {});
          return prev;
        }
        const isSelected = selectedIdRef.current === msg.conversationId;
        const updated: ConversationSummary = {
          ...existing,
          lastMessage: msg,
          updatedAt: msg.createdAt,
          unread: msg.senderId !== myIdRef.current && !isSelected,
        };
        return [updated, ...prev.filter((c) => c.id !== msg.conversationId)];
      });

      if (selectedIdRef.current === msg.conversationId) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        );
        socket.emit("message:read", msg.conversationId);
      }
    };
    socket.on("message:new", onMessageNew);
    return () => {
      socket.off("message:new", onMessageNew);
    };
  }, []);

  // Auto-scroll the open thread to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const unreadCount = conversations.filter((c) => c.unread).length;
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const visible = useMemo(
    () =>
      showUnreadOnly ? conversations.filter((c) => c.unread) : conversations,
    [conversations, showUnreadOnly],
  );

  const open = (id: string) => {
    setSelectedId(id);
    selectedIdRef.current = id;
    setDraft("");
    setMessages([]);
    getMessages(id)
      .then(setMessages)
      .catch(() => {});
    const socket = getSocket();
    socket.emit("conversation:join", id);
    socket.emit("message:read", id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c)),
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!(text && selected)) return;
    getSocket().emit("message:send", {
      conversationId: selected.id,
      body: text,
    });
    setDraft("");
  };

  const openCompose = () => {
    setComposeOpen(true);
    listClinicMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  };

  const startConversation = async (memberId: string) => {
    try {
      const conv = await createConversation({ participantIds: [memberId] });
      setConversations((prev) =>
        prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev],
      );
      setComposeOpen(false);
      open(conv.id);
    } catch {
      notify.error(
        t("messages.startFailedTitle"),
        t("messages.startFailedBody"),
      );
    }
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* Left: conversation list */}
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">
            {t("messages.inbox")}
          </h1>
          <div className="flex items-center gap-1">
            <Button
              aria-pressed={showUnreadOnly}
              onClick={() => setShowUnreadOnly((v) => !v)}
              size="sm"
              type="button"
              variant={showUnreadOnly ? "secondary" : "ghost"}
            >
              {t("messages.unread", { count: unreadCount })}
            </Button>
            <Button
              aria-label={t("messages.newMessage")}
              onClick={openCompose}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              {showUnreadOnly
                ? t("messages.noUnread")
                : t("messages.noConversations")}
            </p>
          ) : (
            visible.map((c) => {
              const last = c.lastMessage;
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
                      {last ? formatTime(last.createdAt) : ""}
                    </span>
                  </div>
                  <span className="w-full truncate text-muted-foreground text-xs">
                    {last?.senderId === myId && t("messages.you")}
                    {last?.body}
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
                <AvatarFallback>{initials(selected.name)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground text-sm">
                  {selected.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {selected.isGroup
                    ? t("messages.peopleCount", {
                        count: selected.participants.length,
                      })
                    : t("messages.directMessage")}
                </span>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card/30 p-4"
              ref={scrollRef}
            >
              <div className="flex flex-col gap-3">
                {messages.map((m) => {
                  const out = m.senderId === myId;
                  return (
                    <div
                      className={cn(
                        "flex flex-col gap-1",
                        out ? "items-end" : "items-start",
                      )}
                      key={m.id}
                    >
                      {selected.isGroup && !out && (
                        <span className="px-1 text-muted-foreground text-[11px]">
                          {m.senderName}
                        </span>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          out
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {m.body}
                      </div>
                      <span className="px-1 text-muted-foreground text-[11px]">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              className="flex items-center gap-2 rounded-2xl border bg-card/30 p-2"
              onSubmit={send}
            >
              <Input
                aria-label={t("messages.newMessage")}
                className="border-0 bg-transparent shadow-none before:hidden"
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("messages.messagePlaceholder", {
                  name: selected.name,
                })}
                value={draft}
              />
              <Button
                aria-label={t("messages.send")}
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
                <EmptyTitle>{t("messages.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("messages.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>

      {/* Compose: pick a clinic member to message */}
      <Dialog onOpenChange={setComposeOpen} open={composeOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("messages.compose.title")}</DialogTitle>
            <DialogDescription>
              {t("messages.compose.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-1">
            {members.length === 0 ? (
              <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                {t("messages.compose.noMembers")}
              </p>
            ) : (
              members.map((m) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                  key={m.id}
                  onClick={() => startConversation(m.id)}
                  type="button"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-foreground text-sm">
                    {m.name}
                  </span>
                </button>
              ))
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
