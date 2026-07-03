// Client for the clinic→wallet record-update push. When a clinician edits a
// wallet-linked patient, they can push the updated record to the patient's app;
// it stays pending until the patient approves it on their phone.

import { apiFetch } from "@/lib/api-client";

export type WalletUpdateStatus = "pending" | "delivered" | "approved" | "denied";

export type WalletUpdate = {
  id: string;
  fileNumber: string;
  walletNumber: string;
  status: WalletUpdateStatus;
  changes: string[];
  createdAt: string;
  deliveredAt: string | null;
  resolvedAt: string | null;
};

// Resolve the wallet a patient is linked to. Rejects (404) when not wallet-backed.
export function getWalletLink(
  fileNumber: string,
): Promise<{ walletNumber: string }> {
  return apiFetch<{ walletNumber: string }>(
    `/api/patients/wallet/link/${encodeURIComponent(fileNumber)}`,
  );
}

export function pushWalletUpdate(input: {
  fileNumber: string;
  changes: string[];
}): Promise<WalletUpdate> {
  return apiFetch<WalletUpdate>("/api/patients/wallet/push", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listWalletUpdates(): Promise<WalletUpdate[]> {
  return apiFetch<WalletUpdate[]>("/api/patients/wallet/updates");
}

export function getWalletUpdate(id: string): Promise<WalletUpdate> {
  return apiFetch<WalletUpdate>(
    `/api/patients/wallet/updates/${encodeURIComponent(id)}`,
  );
}
