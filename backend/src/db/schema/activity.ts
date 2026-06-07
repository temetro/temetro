import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { ActivityEntityType } from "../../types/activity.js";
import { organization, user } from "./auth.js";

// One row per record change, scoped to a clinic (organization). Written
// best-effort from the resource routes (patients / notes / appointments /
// prescriptions / tasks). `actorName` is denormalized so the feed renders even
// after the user is removed (FK is set null).
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").$type<ActivityEntityType>().notNull(),
    entityId: text("entity_id"),
    patientName: text("patient_name"),
    patientFileNumber: text("patient_file_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("activity_org_created_idx").on(t.organizationId, t.createdAt)],
);
