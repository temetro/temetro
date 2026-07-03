import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

export type WalletUpdateStatus =
  | "pending"
  | "delivered"
  | "approved"
  | "denied";

// One row per clinic→wallet record-update push. When a clinician edits a
// wallet-linked patient they can push the updated record to the patient's app;
// it lands here as `pending`, is sealed to the wallet's (X25519-from-Ed25519)
// key and signed with the clinic's Ed25519 key. The relay delivers it live if
// the device is connected, and again on the wallet's next authenticated connect
// (so an offline phone still receives it). The patient reviews the change,
// verifies the clinic signature, and approves/denies in-app — only then is the
// on-device record replaced. The clinic polls `status` for delivery/approval.
export const walletRecordUpdates = pgTable(
  "wallet_record_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileNumber: text("file_number").notNull(),
    walletNumber: text("wallet_number").notNull(),
    status: text("status")
      .$type<WalletUpdateStatus>()
      .notNull()
      .default("pending"),
    // base64 sealed box of the full updated patient snapshot (sealed to the
    // wallet's derived X25519 key).
    payloadSealed: text("payload_sealed").notNull(),
    // The clinic's Ed25519 signature over the plaintext bundle bytes + its
    // public key + fingerprint, so the wallet can verify provenance (TOFU pin).
    clinicSignature: text("clinic_signature").notNull(),
    clinicPublicKey: text("clinic_public_key").notNull(),
    clinicFingerprint: text("clinic_fingerprint").notNull(),
    // Human-readable summary of what changed (shown in the wallet inbox).
    changes: jsonb("changes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    index("wallet_updates_org_idx").on(t.organizationId),
    index("wallet_updates_wallet_idx").on(t.walletNumber),
  ],
);
