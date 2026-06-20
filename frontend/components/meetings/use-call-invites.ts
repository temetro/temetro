"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { toastManager } from "@/components/ui/toast";
import { getSocket } from "@/lib/socket";

type CallInvite = { roomId: string; roomName: string; fromName: string };

// Listens for live "call:invite" events and shows a toast with a Join action
// that drops the user into the room. Mounted once in the app shell (the sidebar)
// so it works from any page.
export function useCallInvites() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const socket = getSocket();
    const onInvite = ({ roomId, roomName, fromName }: CallInvite) => {
      toastManager.add({
        type: "info",
        // Ring long enough for the callee to react; the toast's "x" declines it.
        timeout: 30_000,
        title: t("meetings.invite.toastTitle", { name: fromName }),
        description: roomName,
        actionProps: {
          // "Accept" drops the user straight into the caller's room.
          children: t("meetings.invite.accept"),
          onClick: () =>
            router.push(
              `/messages/meetings?room=${encodeURIComponent(roomId)}`,
            ),
        },
      });
    };
    socket.on("call:invite", onInvite);
    return () => {
      socket.off("call:invite", onInvite);
    };
  }, [router, t]);
}
