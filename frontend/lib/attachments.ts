// Client for the backend attachments API (patient/lab file uploads). Uploads
// use multipart/form-data so they bypass apiFetch (which forces a JSON body).

import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api-client";

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

export function listAttachments(fileNumber: string): Promise<Attachment[]> {
  return apiFetch<Attachment[]>(
    `/api/attachments?fileNumber=${encodeURIComponent(fileNumber)}`,
  );
}

export async function uploadAttachment(opts: {
  file: File;
  fileNumber: string;
  labKey?: string;
}): Promise<Attachment> {
  const form = new FormData();
  form.append("file", opts.file);
  form.append("fileNumber", opts.fileNumber);
  if (opts.labKey) form.append("labKey", opts.labKey);

  const res = await fetch(`${API_BASE_URL}/api/attachments`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Not authenticated.");
  }

  const body = (await res.json().catch(() => null)) as
    | (Attachment & { error?: string })
    | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? `Upload failed with status ${res.status}.`,
    );
  }
  return body as Attachment;
}

export function deleteAttachment(id: string): Promise<void> {
  return apiFetch<void>(`/api/attachments/${id}`, { method: "DELETE" });
}

// Direct URL to stream/preview a stored file (auth via the session cookie).
export function attachmentUrl(id: string): string {
  return `${API_BASE_URL}/api/attachments/${id}`;
}

// "1.2 MB" / "734 KB" — compact size for display.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
