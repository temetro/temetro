"use client";

import { FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Attachment,
  attachmentUrl,
  deleteAttachment,
  formatBytes,
  listAttachments,
} from "@/lib/attachments";
import { notify } from "@/lib/toast";

// A pick-and-stage field: files chosen here are held in `value` until the
// parent uploads them (after the patient/lab record is saved). Used in the
// patient form and the lab "add result" dialog.
export function StagedFilesField({
  value,
  onChange,
  label,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label ?? t("patientFiles.title")}
        </span>
        <Button
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Upload className="size-4" />
          {t("patientFiles.add")}
        </Button>
        <input
          className="hidden"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onChange([...value, ...picked]);
            e.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
      {value.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card/30">
          {value.map((file, index) => (
            <div
              className="flex items-center gap-2.5 px-3 py-2"
              key={`${file.name}-${index}`}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                {file.name}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {formatBytes(file.size)}
              </span>
              <button
                aria-label={t("patientFiles.remove")}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A dialog that previews an attachment: images inline, everything else as a
// download link.
function FilePreviewDialog({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isImage = attachment?.mimeType.startsWith("image/");
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={attachment !== null}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment?.filename}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col items-center gap-3">
          {attachment && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={attachment.filename}
              className="max-h-[60vh] w-auto rounded-lg border object-contain"
              src={attachmentUrl(attachment.id)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileText className="size-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                {t("patientFiles.noPreview")}
              </p>
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("patientFiles.close")}
          </DialogClose>
          {attachment && (
            <Button
              render={
                <a
                  href={attachmentUrl(attachment.id)}
                  rel="noreferrer"
                  target="_blank"
                />
              }
            >
              {t("patientFiles.open")}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

// The sheet's "Files" section: lists a patient's uploaded attachments, opens
// one in a preview dialog, and lets a clinician delete it. `reloadKey` bumps to
// refetch after a new upload elsewhere.
export function AttachmentsSection({
  fileNumber,
  reloadKey = 0,
  canDelete = true,
}: {
  fileNumber: string;
  reloadKey?: number;
  canDelete?: boolean;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Attachment[]>([]);
  const [preview, setPreview] = useState<Attachment | null>(null);

  useEffect(() => {
    let active = true;
    listAttachments(fileNumber)
      .then((rows) => active && setItems(rows))
      .catch(() => {
        /* missing permission / none — leave empty */
      });
    return () => {
      active = false;
    };
  }, [fileNumber, reloadKey]);

  const remove = async (attachment: Attachment) => {
    try {
      await deleteAttachment(attachment.id);
      setItems((prev) => prev.filter((a) => a.id !== attachment.id));
      notify.success(t("patientFiles.deletedTitle"), attachment.filename);
    } catch {
      notify.error(
        t("patientFiles.deleteFailedTitle"),
        t("patientFiles.deleteFailedBody"),
      );
    }
  };

  return (
    <section className="rounded-2xl border bg-card/30 p-4">
      <h3 className="mb-3 font-medium text-foreground text-sm">
        {t("patientFiles.title")}
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("patientFiles.empty")}
        </p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border bg-background/40">
          {items.map((attachment) => (
            <div
              className="flex items-center gap-2.5 px-3 py-2"
              key={attachment.id}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                onClick={() => setPreview(attachment)}
                type="button"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                  {attachment.filename}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {formatBytes(attachment.sizeBytes)}
                </span>
              </button>
              {canDelete && (
                <button
                  aria-label={t("patientFiles.remove")}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive-foreground"
                  onClick={() => remove(attachment)}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <FilePreviewDialog attachment={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
