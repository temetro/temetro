import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.js";

// Files uploaded against a patient record (and optionally a specific lab
// result). Scoped to a clinic (organization). The bytes live on disk under
// UPLOAD_DIR (see src/services/attachments.ts); this table only holds metadata
// plus the relative `storagePath`.
//   fileNumber → the patient's MRN this file belongs to.
//   labKey     → set when the file documents a specific lab result.
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fileNumber: text("file_number"),
    labKey: text("lab_key"),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("attachments_org_file_idx").on(
      table.organizationId,
      table.fileNumber,
    ),
  ],
);
