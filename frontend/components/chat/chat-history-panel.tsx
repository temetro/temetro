"use client";

import { PanelLeft, Plus, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  deleteThread,
  listThreads,
  THREADS_CHANGED_EVENT,
  type ThreadSummary,
} from "@/lib/ai-chat-history";
import { cn } from "@/lib/utils";

// The pill (panel toggle + search) that sits top-left of the AI chat, next to
// the sidebar. Opens a sheet listing saved chats with a "Start new chat" button
// — so chat history is reachable from inside the chat, not just the sidebar.
export function ChatHistoryPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeThread = searchParams.get("thread");

  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => {
      listThreads()
        .then(setThreads)
        .catch(() => {
          /* not signed in / no clinic — show nothing */
        });
    };
    refresh();
    window.addEventListener(THREADS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(THREADS_CHANGED_EVENT, refresh);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((x) => x.title.toLowerCase().includes(q));
  }, [threads, query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const remove = async (event: MouseEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setThreads((prev) => prev.filter((x) => x.id !== id));
    await deleteThread(id).catch(() => {
      /* ignore */
    });
  };

  return (
    <>
      <div className="flex items-center gap-0.5 rounded-full border bg-card/40 p-0.5">
        <button
          aria-label={t("chat.history.open")}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          aria-label={t("chat.history.search")}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search className="size-4" />
        </button>
      </div>

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetPopup side="left">
          <SheetHeader>
            <SheetTitle>{t("chat.history.title")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("chat.history.open")}
            </SheetDescription>
          </SheetHeader>
          <SheetPanel className="flex min-h-0 flex-1 flex-col gap-3">
            <Button className="w-full justify-start" onClick={() => go("/")}>
              <Plus className="size-4" />
              {t("chat.history.startNew")}
            </Button>
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("chat.history.search")}
                value={query}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-muted-foreground text-sm">
                  {t("chat.history.empty")}
                </p>
              ) : (
                filtered.map((thread) => {
                  const active = activeThread === thread.id;
                  return (
                    <button
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground",
                      )}
                      key={thread.id}
                      onClick={() => go(`/?thread=${thread.id}`)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {thread.title}
                      </span>
                      <span
                        aria-label={t("chat.history.delete")}
                        className="shrink-0 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        onClick={(event) => remove(event, thread.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </SheetPanel>
        </SheetPopup>
      </Sheet>
    </>
  );
}
