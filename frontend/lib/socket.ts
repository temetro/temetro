import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "@/lib/api-client";

// A single shared Socket.io connection to the backend, authenticated by the
// Better Auth session cookie (withCredentials). Used by messaging and
// notifications. Created lazily on first use in the browser.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
