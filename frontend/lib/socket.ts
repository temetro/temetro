import { io, type Socket } from "socket.io-client";

import { resolveBackendUrl } from "@/lib/backend-url";

// A single shared Socket.io connection to the backend, authenticated by the
// Better Auth session cookie (withCredentials). Used by messaging and
// notifications. Created lazily on first use in the browser.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Resolved lazily in the browser so it targets the host actually in use.
    socket = io(resolveBackendUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
