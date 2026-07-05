import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./auth.js";

// One Ed25519 signing key per clinic (organization). The clinician's edits to a
// patient record are signed with this key so patients (and other clinics) can
// verify a change really came from this clinic before approving it. The private
// key is stored encrypted at rest (lib/crypto.ts `encryptSecret`); the public
// key + fingerprint are shown in Settings → Signing. Rotating replaces the row.
export const clinicSigningKeys = pgTable("clinic_signing_keys", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  algorithm: text("algorithm").notNull().default("ed25519"),
  publicKey: text("public_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  // Encrypted (lib/crypto.ts) hex of the Ed25519 private key.
  privateKeyEnc: text("private_key_enc").notNull(),
  // Whether this clinic has joined the Temetro Network relay ("Join Temetro
  // Network" in Settings → Signing). Off by default: only when enabled does the
  // backend open this clinic's relay hub connection and expose wallet features.
  // The relay identity *is* this signing key, so the flag lives on the same row.
  networkEnabled: boolean("network_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rotatedAt: timestamp("rotated_at"),
});
