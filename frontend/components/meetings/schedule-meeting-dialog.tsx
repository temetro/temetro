"use client";

import { Check } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { createMeetingEvent } from "@/lib/meetings";
import { listClinicMembers, type Participant } from "@/lib/messages";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultParticipants,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string; // YYYY-MM-DD
  defaultParticipants?: string[]; // member ids to preselect
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id ?? "";

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState("09:00");
  const [members, setMembers] = useState<Participant[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(defaultDate ?? "");
    setTime("09:00");
    setPicked(new Set(defaultParticipants ?? []));
    listClinicMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [open, defaultDate, defaultParticipants]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!(title.trim() && date && time) || saving) return;
    setSaving(true);
    try {
      await createMeetingEvent({
        title: title.trim(),
        date,
        time,
        participants: [...picked],
      });
      onCreated();
      onOpenChange(false);
    } catch {
      notify.error(
        t("meetings.schedule.failedTitle"),
        t("meetings.schedule.failedBody"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("meetings.schedule.title")}</DialogTitle>
          <DialogDescription>
            {t("meetings.schedule.description")}
          </DialogDescription>
        </DialogHeader>
        <form className="contents" onSubmit={submit}>
          <DialogPanel className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-sm" htmlFor="meeting-title">
                {t("meetings.schedule.titleLabel")}
              </label>
              <Input
                id="meeting-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("meetings.schedule.titlePlaceholder")}
                value={title}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm" htmlFor="meeting-date">
                  {t("meetings.schedule.date")}
                </label>
                <Input
                  id="meeting-date"
                  onChange={(e) => setDate(e.target.value)}
                  type="date"
                  value={date}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-sm" htmlFor="meeting-time">
                  {t("meetings.schedule.time")}
                </label>
                <Input
                  id="meeting-time"
                  onChange={(e) => setTime(e.target.value)}
                  type="time"
                  value={time}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">
                {t("meetings.schedule.participants")}
              </span>
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-2xl border p-1">
                {members.filter((m) => m.id !== myId).length === 0 ? (
                  <p className="px-2 py-3 text-center text-muted-foreground text-sm">
                    {t("meetings.invite.noMembers")}
                  </p>
                ) : (
                  members
                    .filter((m) => m.id !== myId)
                    .map((m) => {
                      const on = picked.has(m.id);
                      return (
                        <button
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-accent/50",
                            on && "bg-accent",
                          )}
                          key={m.id}
                          onClick={() => toggle(m.id)}
                          type="button"
                        >
                          <Avatar className="size-7">
                            <AvatarFallback className="text-xs">
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {m.name}
                          </span>
                          {on && <Check className="size-4 text-primary" />}
                        </button>
                      );
                    })
                )}
              </div>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("meetings.cancel")}
            </DialogClose>
            <Button
              disabled={!(title.trim() && date && time) || saving}
              type="submit"
            >
              {saving ? t("meetings.schedule.saving") : t("meetings.schedule.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
