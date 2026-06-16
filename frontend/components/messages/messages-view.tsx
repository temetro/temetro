"use client";

import {
  CalendarClock,
  Download,
  FileText,
  Mail,
  Plus,
  Search,
  SendHorizonal,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  Fragment,
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { type Appointment, listAppointments } from "@/lib/appointments";
import { authClient } from "@/lib/auth-client";
import {
  type ConversationMessage,
  type ConversationSummary,
  type MessageAttachment,
  type Participant,
  createConversation,
  downloadAttachment,
  getMessages,
  listClinicMembers,
  listConversations,
  uploadAttachment,
} from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// Consecutive messages from one sender within this window render as a group:
// one sender label, one timestamp, tighter spacing.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// One sent attachment rendered in the thread: a downloadable file chip or a
// shared-appointment card. Alignment (left/right) comes from the parent column.
function SentAttachment({ att }: { att: MessageAttachment }) {
  const { t } = useTranslation();
  if (att.kind === "file") {
    return (
      <button
        className="flex max-w-[75%] items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-left text-foreground text-sm transition-colors hover:bg-accent"
        onClick={() => {
          void downloadAttachment(att.attachmentId, att.fileName).catch(() => {
            /* ignore — surfaced by the browser */
          });
        }}
        type="button"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 max-w-48 flex-1 truncate">{att.fileName}</span>
        <Download className="size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }
  const a = att.appointment;
  return (
    <div className="max-w-[75%] rounded-2xl border bg-card p-3 text-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <CalendarClock className="size-3.5" />
        {t("messages.attach.apptCardLabel")}
      </div>
      <p className="mt-1 font-medium text-foreground">{a.name}</p>
      <p className="text-muted-foreground text-xs">
        {[a.date, a.time].filter(Boolean).join(" · ")}
      </p>
      {[a.type, a.provider].filter(Boolean).length > 0 && (
        <p className="text-muted-foreground text-xs">
          {[a.type, a.provider].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function MessagesView() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id ?? "";

  // "Today" / "Yesterday" / "Jun 9, 2026" for the thread's day separators.
  const formatDay = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return t("messages.today");
    if (date.toDateString() === yesterday.toDateString()) {
      return t("messages.yesterday");
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [inboxQuery, setInboxQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [members, setMembers] = useState<Participant[]>([]);
  const [memberQuery, setMemberQuery] = useState("");

  // Pending attachments staged for the next message + the attach UI.
  const [pending, setPending] = useState<MessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [apptQuery, setApptQuery] = useState("");

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
        const incoming = msg.senderId !== myIdRef.current && !isSelected;
        const updated: ConversationSummary = {
          ...existing,
          lastMessage: msg,
          updatedAt: msg.createdAt,
          unread: incoming,
          unreadCount: incoming ? existing.unreadCount + 1 : 0,
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

  const visible = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (showUnreadOnly && !c.unread) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage?.body.toLowerCase().includes(q) ?? false)
      );
    });
  }, [conversations, showUnreadOnly, inboxQuery]);

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  }, [members, memberQuery]);

  const open = (id: string) => {
    setSelectedId(id);
    selectedIdRef.current = id;
    setDraft("");
    setPending([]);
    setMessages([]);
    getMessages(id)
      .then(setMessages)
      .catch(() => {});
    const socket = getSocket();
    socket.emit("conversation:join", id);
    socket.emit("message:read", id);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, unread: false, unreadCount: 0 } : c,
      ),
    );
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!((text || pending.length > 0) && selected)) return;
    getSocket().emit("message:send", {
      conversationId: selected.id,
      body: text,
      attachments: pending.length > 0 ? pending : undefined,
    });
    setDraft("");
    setPending([]);
  };

  // Open the file picker; on select, upload each and stage it.
  const onPickFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          notify.error(
            t("messages.attach.tooLargeTitle"),
            t("messages.attach.tooLargeBody"),
          );
          continue;
        }
        const att = await uploadAttachment(file);
        setPending((prev) => [...prev, att]);
      }
    } catch {
      notify.error(
        t("messages.attach.uploadFailedTitle"),
        t("messages.attach.uploadFailedBody"),
      );
    } finally {
      setUploading(false);
    }
  };

  const openApptPicker = () => {
    setApptQuery("");
    setApptOpen(true);
    listAppointments()
      .then(setAppts)
      .catch(() => setAppts([]));
  };

  const attachAppointment = (a: Appointment) => {
    setPending((prev) => [
      ...prev,
      {
        kind: "appointment",
        appointment: {
          fileNumber: a.fileNumber,
          name: a.name,
          date: a.date,
          time: a.time,
          type: a.type,
          provider: a.provider,
          status: a.status,
        },
      },
    ]);
    setApptOpen(false);
  };

  const removePending = (index: number) =>
    setPending((prev) => prev.filter((_, i) => i !== index));

  const visibleAppts = useMemo(() => {
    const q = apptQuery.trim().toLowerCase();
    return q ? appts.filter((a) => a.name.toLowerCase().includes(q)) : appts;
  }, [appts, apptQuery]);

  const openCompose = () => {
    setComposeOpen(true);
    setMemberQuery("");
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
        <div className="border-border border-b px-3 py-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              aria-label={t("messages.searchPlaceholder")}
              className="pl-9"
              onChange={(e) => setInboxQuery(e.target.value)}
              placeholder={t("messages.searchPlaceholder")}
              size="sm"
              value={inboxQuery}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              {inboxQuery.trim()
                ? t("messages.noMatches")
                : showUnreadOnly
                  ? t("messages.noUnread")
                  : t("messages.noConversations")}
            </p>
          ) : (
            visible.map((c) => {
              const last = c.lastMessage;
              return (
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/50",
                    selected?.id === c.id && "bg-accent hover:bg-accent",
                  )}
                  key={c.id}
                  onClick={() => open(c.id)}
                  type="button"
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback>{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex w-full items-center gap-2">
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
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          c.unread
                            ? "font-medium text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {last ? formatTime(last.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs",
                          c.unread
                            ? "text-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {last?.senderId === myId && t("messages.you")}
                        {last?.body}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
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
              <div className="flex flex-col">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const next = messages[i + 1];
                  const out = m.senderId === myId;
                  const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
                  // A bubble starts/ends a group at sender changes, day breaks
                  // or >5 min gaps; the group shares one label + timestamp.
                  const startsGroup =
                    newDay ||
                    !prev ||
                    prev.senderId !== m.senderId ||
                    +new Date(m.createdAt) - +new Date(prev.createdAt) >
                      GROUP_WINDOW_MS;
                  const endsGroup =
                    !next ||
                    next.senderId !== m.senderId ||
                    !sameDay(m.createdAt, next.createdAt) ||
                    +new Date(next.createdAt) - +new Date(m.createdAt) >
                      GROUP_WINDOW_MS;
                  return (
                    <Fragment key={m.id}>
                      {newDay && (
                        <div
                          className={cn(
                            "mb-3 flex items-center gap-3",
                            i > 0 && "mt-5",
                          )}
                        >
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-muted-foreground text-xs">
                            {formatDay(m.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex flex-col gap-1",
                          out ? "items-end" : "items-start",
                          !newDay && (startsGroup ? "mt-4" : "mt-1"),
                        )}
                      >
                        {selected.isGroup && !out && startsGroup && (
                          <span className="px-1 text-muted-foreground text-[11px]">
                            {m.senderName}
                          </span>
                        )}
                        {m.body && (
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                              out
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                              !startsGroup &&
                                (out ? "rounded-tr-md" : "rounded-tl-md"),
                              !endsGroup &&
                                (out ? "rounded-br-md" : "rounded-bl-md"),
                            )}
                          >
                            {m.body}
                          </div>
                        )}
                        {m.attachments?.map((att, ai) => (
                          <SentAttachment
                            att={att}
                            key={`${m.id}-att-${ai}`}
                          />
                        ))}
                        {endsGroup && (
                          <span className="px-1 text-muted-foreground text-[11px]">
                            {formatTime(m.createdAt)}
                          </span>
                        )}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <form
              className="flex flex-col gap-2 rounded-2xl border bg-card/30 p-2"
              onSubmit={send}
            >
              {pending.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
                  {pending.map((att, i) => (
                    <span
                      className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-foreground text-xs"
                      key={`pending-${i}`}
                    >
                      {att.kind === "file" ? (
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="max-w-40 truncate">
                        {att.kind === "file"
                          ? att.fileName
                          : att.appointment.name}
                      </span>
                      <button
                        aria-label={t("messages.attach.remove")}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => removePending(i)}
                        type="button"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Visually hidden (not `display:none`) so the programmatic
                    `.click()` reliably opens the picker across browsers. */}
                <input
                  aria-label={t("messages.attach.file")}
                  className="sr-only"
                  multiple
                  onChange={onPickFiles}
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                />
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        aria-label={t("messages.attach.menu")}
                        disabled={uploading}
                        size="icon"
                        type="button"
                        variant="ghost"
                      />
                    }
                  >
                    <Plus className="size-4" />
                  </MenuTrigger>
                  <MenuPopup align="start" side="top">
                    {/* Defer past the menu's close/unmount so the file picker
                        and the appointment dialog aren't swallowed by the
                        closing overlay's focus handling. */}
                    <MenuItem
                      onClick={() =>
                        requestAnimationFrame(() => fileInputRef.current?.click())
                      }
                    >
                      <FileText className="size-4 text-muted-foreground" />
                      {t("messages.attach.file")}
                    </MenuItem>
                    <MenuItem
                      onClick={() => requestAnimationFrame(openApptPicker)}
                    >
                      <CalendarClock className="size-4 text-muted-foreground" />
                      {t("messages.attach.appointment")}
                    </MenuItem>
                  </MenuPopup>
                </Menu>
                <Input
                  aria-label={t("messages.newMessage")}
                  className="border-0 bg-transparent shadow-none before:hidden"
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    uploading
                      ? t("messages.attach.uploading")
                      : t("messages.messagePlaceholder", { name: selected.name })
                  }
                  value={draft}
                />
                <Button
                  aria-label={t("messages.send")}
                  disabled={!draft.trim() && pending.length === 0}
                  size="icon"
                  type="submit"
                >
                  <SendHorizonal className="size-4" />
                </Button>
              </div>
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
              <EmptyContent>
                <Button onClick={openCompose} type="button" variant="outline">
                  <Plus className="size-4" />
                  {t("messages.startConversation")}
                </Button>
              </EmptyContent>
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
          <DialogPanel className="flex flex-col gap-2">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label={t("messages.compose.searchPlaceholder")}
                className="pl-9"
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder={t("messages.compose.searchPlaceholder")}
                size="sm"
                value={memberQuery}
              />
            </div>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                  {t("messages.compose.noMembers")}
                </p>
              ) : visibleMembers.length === 0 ? (
                <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                  {t("messages.compose.noMatches")}
                </p>
              ) : (
                visibleMembers.map((m) => (
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
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      {/* Share an appointment: search by patient, pick one to attach */}
      <Dialog onOpenChange={setApptOpen} open={apptOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("messages.attach.apptDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("messages.attach.apptDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-2">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label={t("messages.attach.apptSearchPlaceholder")}
                className="pl-9"
                onChange={(e) => setApptQuery(e.target.value)}
                placeholder={t("messages.attach.apptSearchPlaceholder")}
                size="sm"
                value={apptQuery}
              />
            </div>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {appts.length === 0 ? (
                <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                  {t("messages.attach.apptEmpty")}
                </p>
              ) : visibleAppts.length === 0 ? (
                <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                  {t("messages.attach.apptNoMatches")}
                </p>
              ) : (
                visibleAppts.map((a) => (
                  <button
                    className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                    key={a.id}
                    onClick={() => attachAppointment(a)}
                    type="button"
                  >
                    <span className="font-medium text-foreground text-sm">
                      {a.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {[a.date, a.time, a.type, a.provider]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
