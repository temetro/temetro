import path from "node:path";

import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { z } from "zod";

import { HttpError } from "../lib/http-error.js";
import {
  requireAnyPermission,
  requireAuth,
  requireOrg,
} from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import {
  createAttachment,
  deleteAttachment,
  ensureUploadDir,
  getAttachmentRow,
  listAttachments,
  openAttachmentStream,
} from "../services/attachments.js";

export const attachmentsRouter = Router();

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Clinical documents only — block scripts/executables.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/dicom",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// Disk storage under UPLOAD_DIR/<orgId>/, keyed by a random id so original
// names never collide or escape the directory. Runs after requireOrg, so
// req.organizationId is set.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    ensureUploadDir(req.organizationId!)
      .then((dir) => cb(null, dir))
      .catch((err) => cb(err as Error, ""));
  },
  filename: (_req, file, cb) => {
    cb(null, `${nanoid()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, `Unsupported file type: ${file.mimetype}`));
  },
});

// Wrap multer so its errors (size/type) surface as clean 400s.
function uploadSingle(req: never, res: never, next: (err?: unknown) => void) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          err.code === "LIMIT_FILE_SIZE"
            ? "File is too large (max 15 MB)."
            : err.message,
        ),
      );
      return;
    }
    next(err);
  });
}

const linkSchema = z.object({
  fileNumber: z.string().trim().min(1),
  labKey: z.string().trim().min(1).optional(),
});

// POST /api/attachments — upload one file linked to a patient (and optionally a
// specific lab result). Allowed for clinicians (patient:write) or lab staff
// (lab:write).
attachmentsRouter.post(
  "/",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["write"] }, { lab: ["write"] }),
  uploadSingle as never,
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) throw new HttpError(400, "No file uploaded.");
      const parsed = linkSchema.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "A fileNumber is required.");
      const orgId = req.organizationId!;
      const attachment = await createAttachment({
        organizationId: orgId,
        fileNumber: parsed.data.fileNumber,
        labKey: parsed.data.labKey ?? null,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: path.join(orgId, file.filename),
        uploadedByUserId: req.user?.id ?? null,
      });
      await recordActivity({
        orgId,
        actor: { id: req.user?.id, name: req.user?.name },
        action: "attachment.upload",
        entityType: "patient",
        entityId: attachment.id,
        patientFileNumber: parsed.data.fileNumber,
      }).catch(() => {});
      res.status(201).json(attachment);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/attachments?fileNumber=… — list a patient's files.
attachmentsRouter.get(
  "/",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["read"] }, { lab: ["read"] }),
  async (req, res, next) => {
    try {
      const fileNumber = String(req.query.fileNumber ?? "").trim();
      if (!fileNumber) throw new HttpError(400, "A fileNumber is required.");
      res.json(await listAttachments(req.organizationId!, fileNumber));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/attachments/:id — stream/download a file. Images and PDFs are sent
// inline so the client can preview them in a dialog.
attachmentsRouter.get(
  "/:id",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["read"] }, { lab: ["read"] }),
  async (req, res, next) => {
    try {
      const row = await getAttachmentRow(
        req.organizationId!,
        String(req.params.id),
      );
      if (!row) throw new HttpError(404, "File not found.");
      const inline =
        row.mimeType.startsWith("image/") || row.mimeType === "application/pdf";
      res.setHeader("Content-Type", row.mimeType);
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(
          row.filename,
        )}"`,
      );
      const stream = openAttachmentStream(row.storagePath);
      stream.on("error", () => next(new HttpError(404, "File not found.")));
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/attachments/:id — remove a file (row + bytes).
attachmentsRouter.delete(
  "/:id",
  requireAuth,
  requireOrg,
  requireAnyPermission({ patient: ["write"] }, { lab: ["write"] }),
  async (req, res, next) => {
    try {
      const row = await getAttachmentRow(
        req.organizationId!,
        String(req.params.id),
      );
      if (!row) throw new HttpError(404, "File not found.");
      await deleteAttachment(req.organizationId!, row);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
