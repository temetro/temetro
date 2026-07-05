// Client connection to the Temetro Network relay
// (github.com/temetro/temetro-network), a standalone Rust service that routes
// encrypted wallet messages between this backend and patient phones.
//
// This backend was previously the device-facing Socket.io server itself (the
// `/wallet` namespace in realtime.ts). Now it is a *client* of the relay's
// `/hub` namespace: it pushes messages to devices via `sendToWallet` and handles
// their responses here, calling the same wallet service functions the old socket
// handlers did. Sealed bundles are decrypted here (we hold the ephemeral key);
// the relay only ever forwards ciphertext.
//
// The relay is **multi-clinic**: each clinic (organization) authenticates to
// `/hub` with its own Ed25519 signing key (a per-clinic identity, not a shared
// password), and the relay routes each device response back only to the clinic
// that originated the request. So this backend keeps **one hub connection per
// network-enabled org**, opened when the org joins the network ("Join Temetro
// Network" in Settings → Signing) and torn down when it leaves.

import { io as connect, type Socket } from "socket.io-client";

import { env } from "../env.js";
import { networkEnabledOrgs, signWithClinicKey } from "./signing.js";
import * as walletShare from "./wallet-share.js";
import * as walletUpdates from "./wallet-updates.js";

// One authenticated hub connection per network-enabled organization.
const hubs = new Map<string, Socket>();

type Ack = (response: { ok: boolean; [key: string]: unknown }) => void;

// Push an end-to-end-encrypted message to a patient wallet device via the given
// clinic's relay connection (the relay forwards it to the room keyed by wallet
// number). A no-op if the clinic isn't on the network / not connected yet — the
// device replays anything it missed on its next connect (see `wallet:online`).
export function sendToWallet(
  orgId: string,
  walletNumber: string,
  event: string,
  data: unknown,
): void {
  hubs.get(orgId)?.emit("wallet:send", { walletNumber, event, data });
}

// Tell the relay to expect a device response for `requestId` and route it back
// to this clinic — used by **QR pairing**, where there's no wallet number to
// `wallet:send` to yet, so nothing would otherwise register the request.
export function expectResponse(orgId: string, requestId: string): void {
  hubs.get(orgId)?.emit("hub:expect", { requestId });
}

// Open (and authenticate) a hub connection for a clinic, if not already open.
// Idempotent — safe to call on startup, when an org joins the network, and
// before generating a pairing QR. The socket auto-reconnects on its own, so an
// existing entry is left as-is.
export async function connectOrg(orgId: string): Promise<void> {
  if (hubs.has(orgId)) return;

  const hub = connect(`${env.RELAY_URL}/hub`, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });
  hubs.set(orgId, hub);
  registerHubHandlers(orgId, hub);
}

// Leave the network for a clinic: close and forget its hub connection.
export function disconnectOrg(orgId: string): void {
  const hub = hubs.get(orgId);
  if (!hub) return;
  hub.disconnect();
  hubs.delete(orgId);
}

// Open a hub connection for every clinic already on the network. Called once at
// startup; runtime joins/leaves go through connectOrg/disconnectOrg.
export async function initRelayClient(): Promise<void> {
  try {
    const orgs = await networkEnabledOrgs();
    await Promise.all(orgs.map((orgId) => connectOrg(orgId)));
  } catch (err) {
    console.warn(`Temetro Network: failed to open hub connections: ${(err as Error).message}`);
  }
}

// Wire up auth + device-response handlers for one clinic's hub socket.
function registerHubHandlers(orgId: string, hub: Socket): void {
  // Authenticate by signing the relay's challenge with this clinic's signing
  // key. `clinicId` is that key's public half (hex), which is how the relay
  // identifies and routes to this clinic.
  hub.on("hub:challenge", async (payload: { challenge?: string }) => {
    const challenge = String(payload?.challenge ?? "");
    if (!challenge) return;
    try {
      const { signature, publicKey } = await signWithClinicKey(
        orgId,
        new TextEncoder().encode(challenge),
      );
      hub.emit(
        "hub:auth",
        // `token` is only meaningful for a private relay (optional shared gate);
        // an empty value is ignored by an open relay.
        { clinicId: publicKey, signature, token: env.RELAY_TOKEN || undefined },
        async (ack: { ok?: boolean } | undefined) => {
          if (!ack?.ok) {
            console.warn(`Temetro Network: relay rejected clinic ${orgId}`);
            return;
          }
          console.log(`Temetro Network: clinic ${orgId} authenticated on the relay`);
          // The relay keeps routing state in memory, so re-register this clinic's
          // still-pending requests — restores QR-pairing / share routing after a
          // relay restart or a reconnect.
          try {
            for (const requestId of await walletShare.pendingRequestIds(orgId)) {
              expectResponse(orgId, requestId);
            }
          } catch {
            /* best-effort */
          }
        },
      );
    } catch (err) {
      console.warn(`Temetro Network: failed to sign relay challenge for ${orgId}: ${(err as Error).message}`);
    }
  });

  hub.on("connect_error", (err) => {
    console.warn(`Temetro Network relay unreachable (${env.RELAY_URL}) for ${orgId}: ${err.message}`);
  });

  // A device authenticated on the relay — flush any record updates it missed
  // while offline (scoped to this clinic; the relay only delivers this to
  // clinics with pending work for the wallet).
  hub.on("wallet:online", async (payload: { walletNumber?: string }) => {
    const walletNumber = String(payload?.walletNumber ?? "");
    if (!walletNumber) return;
    try {
      const rows = await walletUpdates.pendingUpdatesForWallet(orgId, walletNumber);
      for (const row of rows) {
        sendToWallet(orgId, walletNumber, "wallet:update-request", await walletUpdates.toEvent(row));
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
