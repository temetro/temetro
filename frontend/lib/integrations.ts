// Client for the backend integrations API (HL7/FHIR labs, e-prescribing,
// insurance claims). Config is owner/admin-only to write; status is readable by
// any member so pages can gate their on-page actions.

import { apiFetch } from "@/lib/api-client";

export type IntegrationType = "fhir" | "eprescribe" | "claims";
export type IntegrationStatus = "unconfigured" | "connected" | "error";

export type IntegrationConfig = {
  type: IntegrationType;
  endpoint: string;
  enabled: boolean;
  status: IntegrationStatus;
  hasCredentials: boolean;
  lastSyncAt: string | null;
};

export function listIntegrations(): Promise<IntegrationConfig[]> {
  return apiFetch<IntegrationConfig[]>("/api/integrations");
}

export function saveIntegration(
  type: IntegrationType,
  input: { endpoint?: string; enabled?: boolean; credentials?: string },
): Promise<IntegrationConfig> {
  return apiFetch<IntegrationConfig>(`/api/integrations/${type}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function testIntegration(
  type: IntegrationType,
): Promise<{ ok: boolean; message: string }> {
  return apiFetch(`/api/integrations/${type}/test`, { method: "POST" });
}

// Pull a patient's lab results from the FHIR server.
export function syncFhirLabs(fileNumber: string): Promise<{ imported: number }> {
  return apiFetch("/api/integrations/fhir/sync", {
    method: "POST",
    body: JSON.stringify({ fileNumber }),
  });
}

// Transmit a prescription to a pharmacy (NCPDP SCRIPT NewRx).
export function sendEprescription(
  rxId: string,
): Promise<{ messageId: string; status: string }> {
  return apiFetch("/api/integrations/eprescribe/send", {
    method: "POST",
    body: JSON.stringify({ rxId }),
  });
}

// Submit an insurance claim for an invoice (X12 837P) and read the remittance.
export function submitInsuranceClaim(
  invoiceId: string,
): Promise<{ claimStatus: string; paidAmount: number; submitted: boolean }> {
  return apiFetch("/api/integrations/claims/submit", {
    method: "POST",
    body: JSON.stringify({ invoiceId }),
  });
}

// Convenience hook-style fetch reused by the on-page sections: returns the
// config for one type (or null while loading/absent).
export async function getIntegration(
  type: IntegrationType,
): Promise<IntegrationConfig | null> {
  try {
    const all = await listIntegrations();
    return all.find((c) => c.type === type) ?? null;
  } catch {
    return null;
  }
}
