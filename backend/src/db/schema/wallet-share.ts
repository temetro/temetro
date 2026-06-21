import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { Patient } from "../../types/patient.js";
import { organization, user } from "./auth.js";

export type WalletShareStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired";
export type WalletShareMode = "permanent" | "temporary";

// One row per "import from a patient app" request. A clinician enters a wallet
// number; we mint a per-request ephemeral X25519 keypair (the phone seals the
// record bundle to its public key) and relay a `share:request` to the device
// over the /wallet Socket.io namespace. The patient approves on their phone; the
// sealed bundle comes back, we decrypt it with `ephemeralPrivEnc` and hand the
// clinic a draft Patient to review. Nothing here is the record itself — only the
// transient handshake + the decrypted draft cached until the clinic commits it.
export const walletShareRequests = pgTable(
  "wallet_share_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    walletNumber: text("wallet_number").notNull(),
    ephemeralPubKey: text("ephemeral_pub_key").notNull(),
    // Encrypted (lib/crypto.ts) hex of the ephemeral X25519 private key.
    ephemeralPrivEnc: text("ephemeral_priv_enc").notNull(),
    status: text("status").$type<WalletShareStatus>().notNull().default("pending"),
    shareMode: text("share_mode").$type<WalletShareMode>().notNull().default("permanent"),
    // For temporary shares: when the imported record should be auto-deleted.
    shareExpiresAt: timestamp("share_expires_at"),
    // The decrypted, verified draft record, cached between approval and commit.
    draft: jsonb("draft").$type<Patient | null>(),
    // Set once the clinic commits the draft — the imported patient's file number,
    // so a later patient "revoke" from the app can delete exactly that record.
    committedFileNumber: text("committed_file_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    index("wallet_share_org_idx").on(t.organizationId),
    index("wallet_share_wallet_idx").on(t.walletNumber),
  ],
);
