"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSidebar } from "@/components/ui/sidebar";
import {
  deleteThread,
  listThreads,
  THREADS_CHANGED_EVENT,
  type ThreadSummary,
} from "@/lib/ai-chat-history";
import { cn } from "@/lib/utils";

// Claude-style list of saved AI chats in the sidebar. Refreshes when a chat is
// saved/deleted (via the THREADS_CHANGED_EVENT). Hidden when collapsed or empty.
export function NavChatHistory() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeThread = searchParams.get("thread");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    const refresh = () => {
      listThreads()
        .then(setThreads)
        .catch(() => {
          /* not signed in / no clinic — just show nothing */
        });
    };
    refresh();
    window.addEventListener(THREADS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(THREADS_CHANGED_EVENT, refresh);
  }, []);

  if (state === "collapsed" || threads.length === 0) return null;

  const remove = async (event: MouseEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setThreads((prev) => prev.filter((x) => x.id !== id));
    await deleteThread(id).catch(() => {
      /* ignore */
    });
  };

  return (
    <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2">
      <span className="px-2 py-1 font-medium text-muted-foreground text-xs">
        {t("chat.history.title")}
      </span>
      {threads.map((thread) => {
        const active = pathname === "/" && activeThread === thread.id;
        return (
          <Link
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              active ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            href={`/?thread=${thread.id}`}
            key={thread.id}
          >
            <span className="min-w-0 flex-1 truncate">{thread.title}</span>
            <button
              aria-label={t("chat.history.delete")}
              className="shrink-0 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={(event) => remove(event, thread.id)}
              type="button"
            >
              <Trash2 className="size-3.5" />
            </button>
          </Link>
        );
      })}
    </div>
  );
}
