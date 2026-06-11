import { apiFetch } from "@/lib/api-client";

// A clinician who can be assigned as a patient's primary provider. Returned by
// the backend's GET /api/staff/providers (clinical roles only — excludes
// reception/pharmacy/lab). Readable by any clinic member.
export type Provider = {
  userId: string;
  name: string;
  role: string;
};

export function listProviders(): Promise<Provider[]> {
  return apiFetch<Provider[]>("/api/staff/providers");
}
