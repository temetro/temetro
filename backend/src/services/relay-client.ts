// Client connection to the Temetro Network relay
// (github.com/temetro/temetro-network), a standalone Rust service that routes
// encrypted wallet messages between this backend and patient phones.
//
// This backend was previously the device-facing Socket.io server itself (the
// `/wallet` namespace in realtime.ts). Now it is a *client* of the relay's
// privileged `/hub` namespace: it pushes messages to devices via `sendToWallet`
// and handles their responses here, calling the same wallet service functions
// the old socket handlers did. Sealed bundles are decrypted here (we hold the
// ephemeral key); the relay only ever forwards ciphertext.

import { io as connect, type Socket } from "socket.io-client";

import { env } from "../env.js";
import * as walletShare from "./wallet-share.js";
import * as walletUpdates from "./wallet-updates.js";

let hub: Socket | null = null;

type Ack = (response: { ok: boolean; [key: string]: unknown }) => void;

// Push an end-to-end-encrypted message to a patient wallet device via the relay
// (which forwards it to the room keyed by wallet number). Mirrors the old
// in-process `emitToWallet`. A no-op if the relay is not connected yet — the
// device replays anything it missed on its next connect (see `wallet:online`).
export function sendToWallet(
  walletNumber: string,
  event: string,
  data: unknown,
): void {
  hub?.emit("wallet:send", { walletNumber, event, data });
}

export function initRelayClient(): void {
  hub = connect(`${env.RELAY_URL}/hub`, {
    auth: { token: env.RELAY_TOKEN },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });

  hub.on("connect", () => {
    console.log(`Connected to Temetro Network relay at ${env.RELAY_URL}`);
  });
  hub.on("connect_error", (err) => {
    console.warn(`Temetro Network relay unreachable (${env.RELAY_URL}): ${err.message}`);
  });

  // A device authenticated on the relay — flush any record updates it missed
  // while offline (the relay forwards each back to it). Mirrors the replay the
  // old /wallet namespace did on connect.
  hub.on("wallet:online", async (payload: { walletNumber?: string }) => {
    const walletNumber = String(payload?.walletNumber ?? "");
    if (!walletNumber) return;
    try {
      const rows = await walletUpdates.pendingUpdatesForWallet(walletNumber);
      for (const row of rows) {
        sendToWallet(walletNumber, "wallet:update-request", await walletUpdates.toEvent(row));
        await walletUpdates.markDelivered(row.id);
      }
    } catch {
      /* best-effort */
    }
  });

  // The patient approved/denied a clinic→wallet record update. Verify the
  // wallet's signature over the decision and resolve the row.
  hub.on(
    "wallet:update-response",
    async (
      payload: {
        requestId?: string;
        walletNumber?: string;
        decision?: "approved" | "denied";
        signature?: string;
      },
      ack?: Ack,
    ) => {
      try {
        const view = await walletUpdates.applyUpdateResponse(
          String(payload?.requestId ?? ""),
          String(payload?.walletNumber ?? ""),
          payload?.decision === "approved" ? "approved" : "denied",
          payload?.signature,
        );
        ack?.({ ok: !!view });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  // The patient approved/denied a share; the sealed bundle (if approved) rides
  // along and is decrypted + verified here.
  hub.on(
    "wallet:share-response",
    async (
      payload: {
        requestId?: string;
        walletNumber?: string;
        decision?: "approved" | "denied";
        sealed?: string;
        signature?: string;
      },
      ack?: Ack,
    ) => {
      try {
        const view = await walletShare.applyShareResponse(
          String(payload?.requestId ?? ""),
          String(payload?.walletNumber ?? ""),
          payload?.decision === "approved" ? "approved" : "denied",
          payload?.sealed,
          payload?.signature,
        );
        ack?.({ ok: !!view });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  // The patient revoked a previously shared record; delete it from the clinic.
  hub.on(
    "wallet:revoke",
    async (payload: { requestId?: string; walletNumber?: string }, ack?: Ack) => {
      try {
        const result = await walletShare.revokeShare(
          String(payload?.requestId ?? ""),
          String(payload?.walletNumber ?? ""),
        );
        ack?.({ ok: !!result });
      } catch {
        ack?.({ ok: false });
      }
    },
  );
}
