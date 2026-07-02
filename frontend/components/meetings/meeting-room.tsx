"use client";

import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Search,
  UserPlus,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSpeaking } from "@/components/meetings/use-audio-level";
import { useWebRtcMesh } from "@/components/meetings/use-webrtc-mesh";
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
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { listClinicMembers, type Participant } from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

// One participant tile: video when the camera is on, an avatar otherwise, with a
// green speaking ring driven by the stream's audio level.
function VideoTile({
  stream,
  label,
  caption,
  muted,
  showVideo,
}: {
  stream: MediaStream | null;
  label: string;
  // The corner caption (e.g. "You"); falls back to `label` when omitted. Initials
  // are always derived from `label` (the real name), never the caption.
  caption?: string;
  muted?: boolean;
  showVideo: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Analyse the stream's audio for the speaking ring (muting only affects
  // playback, so the local tile still gets a ring when you talk).
  const speaking = useSpeaking(stream);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-2xl border-2 bg-muted transition-colors",
        speaking ? "border-success" : "border-transparent",
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        autoPlay
        className={cn("size-full object-cover", !showVideo && "invisible")}
        muted={muted}
        playsInline
        ref={ref}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary/15 text-foreground text-lg">
              {initials(label)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-background/70 px-2 py-0.5 text-foreground text-xs backdrop-blur">
        {caption ?? label}
      </span>
    </div>
  );
}

// A round control-bar button with a tooltip label.
function ControlButton({
  label,
  onClick,
  active,
  variant = "secondary",
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: "secondary" | "outline" | "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="size-14 rounded-full"
            onClick={onClick}
            size="icon"
            variant={active === false ? "outline" : variant}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

export function MeetingRoom({
  roomId,
  roomName,
  selfName,
  onLeave,
}: {
  roomId: string;
  roomName: string;
  selfName: string;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id ?? "";
  const {
    localStream,
    peers,
    joinState,
    micOn,
    camOn,
    screenOn,
    toggleMic,
    toggleCam,
    toggleScreen,
    maxPeers,
  } = useWebRtcMesh(roomId);

  // Invite picker.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<Participant[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const openInvite = () => {
    setInviteOpen(true);
    setMemberQuery("");
    listClinicMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
  };

  const invite = (userId: string) => {
    getSocket().emit("call:invite", { roomId, toUserId: userId });
    setInvited((prev) => new Set(prev).add(userId));
  };

  const visibleMembers = members.filter(
    (m) =>
      m.id !== myId &&
      m.name.toLowerCase().includes(memberQuery.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card/30 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground text-sm">
            {roomName}
          </span>
          <span className="text-muted-foreground text-xs">
            {joinState === "joined"
              ? t("meetings.inCall", { count: peers.length + 1 })
              : joinState === "joining"
                ? t("meetings.connecting")
                : joinState === "full"
                  ? t("meetings.roomFull", { max: maxPeers })
                  : joinState === "error"
                    ? t("meetings.callError")
                    : ""}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-card/30 p-4">
        {joinState === "full" || joinState === "error" ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
            {joinState === "full"
              ? t("meetings.roomFull", { max: maxPeers })
              : t("meetings.callError")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <VideoTile
              caption={t("meetings.you")}
              label={selfName || t("meetings.you")}
              muted
              showVideo={camOn && Boolean(localStream)}
              stream={localStream}
            />
            {peers.map((p) => (
              <VideoTile
                key={p.socketId}
                label={p.userName || t("meetings.guest")}
                showVideo={Boolean(p.stream)}
                stream={p.stream}
              />
            ))}
          </div>
        )}
      </div>

      {/* Discord-style control bar — a compact pill that hugs its buttons */}
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-2 backdrop-blur">
        <ControlButton
          active={micOn}
          label={micOn ? t("meetings.muteMic") : t("meetings.unmuteMic")}
          onClick={toggleMic}
        >
          {micOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </ControlButton>
        <ControlButton
          active={camOn}
          label={camOn ? t("meetings.stopVideo") : t("meetings.startVideo")}
          onClick={toggleCam}
        >
          {camOn ? (
            <VideoIcon className="size-6" />
          ) : (
            <VideoOff className="size-6" />
          )}
        </ControlButton>
        <ControlButton
          label={t("meetings.shareScreen")}
          onClick={() => void toggleScreen()}
          variant={screenOn ? "default" : "secondary"}
        >
          <MonitorUp className="size-6" />
        </ControlButton>
        <ControlButton label={t("meetings.invite.add")} onClick={openInvite}>
          <UserPlus className="size-6" />
        </ControlButton>
        <div className="mx-1 h-8 w-px bg-border" />
        <ControlButton
          label={t("meetings.leave")}
          onClick={onLeave}
          variant="destructive"
        >
          <PhoneOff className="size-6" />
        </ControlButton>
      </div>

      <Dialog onOpenChange={setInviteOpen} open={inviteOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("meetings.invite.title")}</DialogTitle>
            <DialogDescription>
              {t("meetings.invite.description", { room: roomName })}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-2">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                aria-label={t("meetings.invite.search")}
                className="ps-9"
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder={t("meetings.invite.search")}
                size="sm"
                value={memberQuery}
              />
            </div>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {visibleMembers.length === 0 ? (
                <p className="px-1 py-4 text-center text-muted-foreground text-sm">
                  {t("meetings.invite.noMembers")}
                </p>
              ) : (
                visibleMembers.map((m) => (
                  <div
                    className="flex items-center gap-3 rounded-lg px-2 py-2"
                    key={m.id}
                  >
                    <Avatar className="size-8">
                      <AvatarFallback>{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                      {m.name}
                    </span>
                    <Button
                      disabled={invited.has(m.id)}
                      onClick={() => invite(m.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {invited.has(m.id)
                        ? t("meetings.invite.invited")
                        : t("meetings.invite.ring")}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
