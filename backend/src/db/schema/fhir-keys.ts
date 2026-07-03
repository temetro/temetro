import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// Per-organization API keys for the read-only FHIR R4 server (`/fhir`). These
// are machine-to-machine credentials (no Better Auth session): a caller sends
// `Authorization: Bearer tmf_<secret>` and every query is scoped to the owning
// clinic. Only the SHA-256 *hash* of the secret is stored — the plaintext key is
// shown once at creation and never again. Revoking sets `revokedAt` (kept for
// audit rather than hard-deleted).
export const fhirApiKeys = pgTable(
  "fhir_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Hex SHA-256 of the full `tmf_…` secret. Unique so a lookup is a single
    // indexed probe and two keys can never collide.
    keyHash: text("key_hash").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("fhir_api_keys_org_idx").on(t.organizationId)],
);
