"use client";

import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useWebRtcMesh } from "@/components/meetings/use-webrtc-mesh";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

// One participant tile: shows their video, or an avatar when the camera is off.
function VideoTile({
  stream,
  label,
  muted,
  showVideo,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  showVideo: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border bg-muted">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        autoPlay
        className={cn("size-full object-cover", !showVideo && "invisible")}
        muted={muted}
        playsInline
        ref={ref}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(label)}</AvatarFallback>
          </Avatar>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-background/70 px-2 py-0.5 text-foreground text-xs backdrop-blur">
        {label}
      </span>
    </div>
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

  const leave = () => {
    onLeave();
  };

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
        {joinState === "full" ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
            {t("meetings.roomFull", { max: maxPeers })}
          </div>
        ) : joinState === "error" ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
            {t("meetings.callError")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <VideoTile
              label={t("meetings.you")}
              muted
              showVideo={camOn && Boolean(localStream)}
              stream={localStream}
            />
            {peers.map((p) => (
              <VideoTile
                key={p.socketId}
                label={p.userName || selfName}
                showVideo={Boolean(p.stream)}
                stream={p.stream}
              />
            ))}
          </div>
        )}
      </div>

      {/* Discord-style control bar */}
      <div className="flex items-center justify-center gap-2 rounded-full border bg-card/60 p-2 backdrop-blur">
        <Button
          aria-label={micOn ? t("meetings.muteMic") : t("meetings.unmuteMic")}
          className="size-11 rounded-full"
          onClick={toggleMic}
          size="icon"
          variant={micOn ? "secondary" : "outline"}
        >
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </Button>
        <Button
          aria-label={camOn ? t("meetings.stopVideo") : t("meetings.startVideo")}
          className="size-11 rounded-full"
          onClick={toggleCam}
          size="icon"
          variant={camOn ? "secondary" : "outline"}
        >
          {camOn ? (
            <VideoIcon className="size-5" />
          ) : (
            <VideoOff className="size-5" />
          )}
        </Button>
        <Button
          aria-label={t("meetings.shareScreen")}
          className="size-11 rounded-full"
          onClick={() => void toggleScreen()}
          size="icon"
          variant={screenOn ? "default" : "secondary"}
        >
          <MonitorUp className="size-5" />
        </Button>
        <Button
          aria-label={t("meetings.leave")}
          className="size-11 rounded-full"
          onClick={leave}
          size="icon"
          variant="destructive"
        >
          <PhoneOff className="size-5" />
        </Button>
      </div>
    </div>
  );
}
