import { useEffect, useState } from "react";

import {
  type Notification,
  listNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { getSocket } from "@/lib/socket";

// Loads the signed-in user's notifications and keeps them live via the shared
// socket ("notification:new"). Exposes a markAllRead action for the popover.
export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    listNotifications()
      .then((res) => {
        if (active) {
          setItems(res.notifications);
          setUnread(res.unread);
        }
      })
      .catch(() => {
        /* api-client redirects on 401 */
      });

    const socket = getSocket();
    const onNew = (n: Notification) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      active = false;
      socket.off("notification:new", onNew);
    };
  }, []);

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      /* best-effort */
    }
  };

  return { items, unread, markAllRead };
}
