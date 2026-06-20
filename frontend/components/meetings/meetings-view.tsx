"use client";

import { CalendarDays, Plus, Users, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MeetingRoom } from "@/components/meetings/meeting-room";
import { ScheduleMeetingDialog } from "@/components/meetings/schedule-meeting-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  listMeetingEvents,
  listMeetingRooms,
  type MeetingRoom as Room,
  type ScheduledMeeting,
} from "@/lib/meetings";
import { getSocket } from "@/lib/socket";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Tab = "rooms" | "calendar";

// Local YYYY-MM-DD key for a Date (no UTC drift), matching how meetings store date.
function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function MeetingsView() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const selfName = session?.user?.name ?? "";

  const searchParams = useSearchParams();
  const deepLinkRoom = searchParams.get("room");
  // ?with=<userId> from the Messages inbox "call" button — open the scheduler
  // pre-targeted at that person so the user can connect with them.
  const deepLinkWith = searchParams.get("with");
  const openedDeepLink = useRef<string | null>(null);
  const openedWith = useRef<string | null>(null);

  const [tab, setTab] = useState<Tab>("rooms");

  // Rooms / live calls.
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Scheduled meetings (calendar).
  const [events, setEvents] = useState<ScheduledMeeting[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    listMeetingRooms()
      .then(setRooms)
      .catch(() => {});
  }, []);

  const loadEvents = () => {
    listMeetingEvents()
      .then(setEvents)
      .catch(() => {});
  };
  useEffect(loadEvents, []);

  // Live room occupancy.
  useEffect(() => {
    const socket = getSocket();
    const onPresence = ({ roomId, count }: { roomId: string; count: number }) => {
      setPresence((prev) => ({ ...prev, [roomId]: count }));
    };
    socket.on("call:presence", onPresence);
    return () => {
      socket.off("call:presence", onPresence);
    };
  }, []);

  // Auto-join a room deep-linked from an invite (?room=).
  useEffect(() => {
    if (!deepLinkRoom || rooms.length === 0) return;
    if (openedDeepLink.current === deepLinkRoom) return;
    const room = rooms.find((r) => r.id === deepLinkRoom);
    if (!room) return;
    openedDeepLink.current = deepLinkRoom;
    setTab("rooms");
    setActiveRoom(room);
  }, [deepLinkRoom, rooms]);

  // Open the scheduler pre-targeted at a person (?with=) from the inbox.
  useEffect(() => {
    if (!deepLinkWith || openedWith.current === deepLinkWith) return;
    openedWith.current = deepLinkWith;
    setTab("calendar");
    setScheduleOpen(true);
  }, [deepLinkWith]);

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

  const meetingDays = useMemo(
    () => events.map((e) => new Date(`${e.date}T00:00:00`)),
    [events],
  );
  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === keyOf(selectedDay))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, selectedDay],
  );

  // Midnight today — used to disable past calendar dates and filter "upcoming".
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  // Next few meetings from today onward, soonest first.
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(`${e.date}T${e.time}`) >= now)
      .sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      )
      .slice(0, 4);
  }, [events]);

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      {/* Header: Rooms / Calendar tabs */}
      <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-1 self-start">
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-sm transition-colors",
            tab === "rooms"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("rooms")}
          type="button"
        >
          <Video className="size-4" />
          {t("meetings.rooms")}
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-sm transition-colors",
            tab === "calendar"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTab("calendar")}
          type="button"
        >
          <CalendarDays className="size-4" />
          {t("meetings.calendar")}
        </button>
      </div>

      {tab === "rooms" ? (
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Room (channel) list */}
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
                rooms.map((room) => {
                  const count = presence[room.id] ?? 0;
                  return (
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
                      {count > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-success/15 px-1.5 text-success text-xs">
                          <Users className="size-3" />
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Live call or lobby */}
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
                    <Button
                      onClick={() => setCreateOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      <Plus className="size-4" />
                      {t("meetings.newRoom")}
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Calendar tab
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border bg-card/30 p-3">
            <Calendar
              disabled={{ before: today }}
              mode="single"
              modifiers={{ hasMeeting: meetingDays }}
              modifiersClassNames={{
                hasMeeting:
                  "relative after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              }}
              onSelect={(d) => d && setSelectedDay(d)}
              required
              selected={selectedDay}
            />
            <Button onClick={() => setScheduleOpen(true)} type="button">
              <Plus className="size-4" />
              {t("meetings.schedule.cta")}
            </Button>

            <div className="flex min-h-0 flex-col gap-1.5">
              <span className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {t("meetings.upcoming.title")}
              </span>
              {upcoming.length === 0 ? (
                <p className="px-1 py-2 text-muted-foreground text-xs">
                  {t("meetings.upcoming.empty")}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {upcoming.map((e) => (
                    <button
                      className="flex flex-col gap-0.5 rounded-xl border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
                      key={e.id}
                      onClick={() => setSelectedDay(new Date(`${e.date}T00:00:00`))}
                      type="button"
                    >
                      <span className="truncate font-medium text-foreground text-sm">
                        {e.title}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}{" "}
                        · {e.time}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card/30">
            <div className="border-border border-b px-4 py-3">
              <h2 className="font-semibold text-base tracking-tight">
                {selectedDay.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
              {dayEvents.length === 0 ? (
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarDays />
                    </EmptyMedia>
                    <EmptyTitle>{t("meetings.calendarEmpty")}</EmptyTitle>
                    <EmptyDescription>
                      {t("meetings.calendarEmptyHint")}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      onClick={() => setScheduleOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      <Plus className="size-4" />
                      {t("meetings.schedule.cta")}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                dayEvents.map((e) => (
                  <div
                    className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5"
                    key={e.id}
                  >
                    <span className="font-medium text-foreground text-sm tabular-nums">
                      {e.time}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-foreground text-sm">
                        {e.title}
                      </span>
                      <span className="truncate text-muted-foreground text-xs">
                        {e.participantNames.join(", ")}
                      </span>
                    </div>
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">
                        {e.participantNames.length}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create room dialog */}
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

      <ScheduleMeetingDialog
        defaultDate={keyOf(selectedDay)}
        defaultParticipants={deepLinkWith ? [deepLinkWith] : undefined}
        onCreated={loadEvents}
        onOpenChange={setScheduleOpen}
        open={scheduleOpen}
      />
    </div>
  );
}
