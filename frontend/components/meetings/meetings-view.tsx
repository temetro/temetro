"use client";

import { Plus, Video } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { MeetingRoom } from "@/components/meetings/meeting-room";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
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
import { authClient } from "@/lib/auth-client";
import {
  createMeetingRoom,
  listMeetingRooms,
  type MeetingRoom as Room,
} from "@/lib/meetings";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function MeetingsView() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const selfName = session?.user?.name ?? "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listMeetingRooms()
      .then(setRooms)
      .catch(() => {
        /* api-client redirects on 401 */
      });
  }, []);

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const room = await createMeetingRoom(name);
      setRooms((prev) => [...prev, room]);
      setCreateOpen(false);
      setNewName("");
      setActiveRoom(room);
    } catch {
      notify.error(t("meetings.createFailedTitle"), t("meetings.createFailedBody"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full w-full gap-4 p-4">
      {/* Left: room (channel) list */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card/30">
        <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-3">
          <h1 className="font-semibold text-base tracking-tight">
            {t("meetings.rooms")}
          </h1>
          <Button
            aria-label={t("meetings.newRoom")}
            onClick={() => setCreateOpen(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {rooms.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-sm">
              {t("meetings.noRooms")}
            </p>
          ) : (
            rooms.map((room) => (
              <button
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/50",
                  activeRoom?.id === room.id && "bg-accent hover:bg-accent",
                )}
                key={room.id}
                onClick={() => setActiveRoom(room)}
                type="button"
              >
                <Video className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                  {room.name}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Right: the live call, or a lobby */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeRoom ? (
          <MeetingRoom
            key={activeRoom.id}
            onLeave={() => setActiveRoom(null)}
            roomId={activeRoom.id}
            roomName={activeRoom.name}
            selfName={selfName}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border bg-card/30">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Video />
                </EmptyMedia>
                <EmptyTitle>{t("meetings.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("meetings.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setCreateOpen(true)} type="button" variant="outline">
                  <Plus className="size-4" />
                  {t("meetings.newRoom")}
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        )}
      </div>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("meetings.newRoom")}</DialogTitle>
            <DialogDescription>{t("meetings.newRoomDescription")}</DialogDescription>
          </DialogHeader>
          <form className="contents" onSubmit={createRoom}>
            <DialogPanel>
              <Input
                aria-label={t("meetings.roomNameLabel")}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("meetings.roomNamePlaceholder")}
                value={newName}
              />
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                {t("meetings.cancel")}
              </DialogClose>
              <Button disabled={!newName.trim() || creating} type="submit">
                {creating ? t("meetings.creating") : t("meetings.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
