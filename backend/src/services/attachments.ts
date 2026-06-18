import { createReadStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { attachments } from "../db/schema/attachments.js";
import { user } from "../db/schema/auth.js";
import { env } from "../env.js";

type AttachmentRow = typeof attachments.$inferSelect;

// API shape returned to the client (no on-disk path leaked).
export type Attachment = {
  id: string;
  fileNumber: string | null;
  labKey: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  createdAt: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Absolute path on disk for a stored file's relative `storagePath`.
export function absolutePath(storagePath: string): string {
  return path.resolve(env.UPLOAD_DIR, storagePath);
}

// The directory new uploads for a clinic are written to (created on demand).
export async function ensureUploadDir(orgId: string): Promise<string> {
  const dir = path.resolve(env.UPLOAD_DIR, orgId);
  await mkdir(dir, { recursive: true });
  return dir;
}

function toAttachment(
  row: AttachmentRow,
  uploadedByName: string | null,
): Attachment {
  return {
    id: row.id,
    fileNumber: row.fileNumber,
    labKey: row.labKey,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createAttachment(input: {
  organizationId: string;
  fileNumber: string | null;
  labKey: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedByUserId: string | null;
}): Promise<Attachment> {
  const [row] = await db.insert(attachments).values(input).returning();
  if (!row) throw new Error("Failed to create attachment.");
  return toAttachment(row, null);
}

export async function listAttachments(
  orgId: string,
  fileNumber: string,
): Promise<Attachment[]> {
  const rows = await db
    .select({ a: attachments, uploaderName: user.name })
    .from(attachments)
    .leftJoin(user, eq(attachments.uploadedByUserId, user.id))
    .where(
      and(
        eq(attachments.organizationId, orgId),
        eq(attachments.fileNumber, fileNumber),
      ),
    )
    .orderBy(desc(attachments.createdAt));
  return rows.map((r) => toAttachment(r.a, r.uploaderName));
}

// The raw row (incl. storagePath), scoped to the clinic — for download/delete.
export async function getAttachmentRow(
  orgId: string,
  id: string,
): Promise<AttachmentRow | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.organizationId, orgId), eq(attachments.id, id)))
    .limit(1);
  return row ?? null;
}

// Stream a stored file's bytes from disk.
export function openAttachmentStream(storagePath: string) {
  return createReadStream(absolutePath(storagePath));
}

// Remove the DB row and best-effort delete the file from disk.
export async function deleteAttachment(
  orgId: string,
  row: AttachmentRow,
): Promise<void> {
  await db
    .delete(attachments)
    .where(
      and(eq(attachments.organizationId, orgId), eq(attachments.id, row.id)),
    );
  await unlink(absolutePath(row.storagePath)).catch(() => {
    /* file already gone — ignore */
  });
}
