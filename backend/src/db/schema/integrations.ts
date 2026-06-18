import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { organization } from "./auth.js";

// External healthcare-system integrations, configured per clinic. One row per
// (organization, type):
//   fhir       → HL7/FHIR lab-system connection (lab results in/out)
//   eprescribe → NCPDP SCRIPT e-prescribing to pharmacies
//   claims     → X12 837/835 insurance claims clearinghouse
// `credentials` is an encrypted JSON blob (API key / bearer token / submitter
// IDs — shape depends on the type); `endpoint` is the base URL the clinic
// points the integration at (a vendor sandbox or production gateway).
export const integrations = pgTable(
  "integrations",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    endpoint: text("endpoint").notNull().default(""),
    credentials: text("credentials"),
    enabled: boolean("enabled").notNull().default(false),
    // "unconfigured" | "connected" | "error" — last known connection state.
    status: text("status").notNull().default("unconfigured"),
    lastSyncAt: timestamp("last_sync_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.type] }),
  ],
);
