import { apiFetch } from "@/lib/api-client";

// A clinician who can be assigned as a patient's primary provider. Returned by
// the backend's GET /api/staff/providers (clinical roles only — excludes
// reception/pharmacy/lab). Readable by any clinic member.
export type Provider = {
  userId: string;
  name: string;
  role: string;
  // Admin-set clinical specialty (e.g. "Orthopedist"); null when unset.
  specialty?: string | null;
};

export function listProviders(): Promise<Provider[]> {
  return apiFetch<Provider[]>("/api/staff/providers");
}

// Set a member's password directly (owner/admin only) — used when an employee
// forgot it and no email provider is configured.
export function setStaffPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/staff/${encodeURIComponent(userId)}/password`, {
    method: "PATCH",
    body: JSON.stringify({ newPassword }),
  });
}

// Update a member's clinical specialty (owner/admin only). Pass null to clear.
export function updateStaffSpecialty(
  userId: string,
  specialty: string | null,
): Promise<{ userId: string; specialty: string | null }> {
  return apiFetch(`/api/staff/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ specialty }),
  });
}

// Curated list of clinical specialties an admin can assign to a doctor. Stored
// as the plain string; values double as the i18n key suffix
// (settings.careTeam.specialties.*).
// Human label for a stored specialty key (settings.careTeam.specialties.*),
// falling back to the raw value for any legacy/free-text entries.
export function specialtyLabel(
  t: (key: string) => string,
  specialty?: string | null,
): string | null {
  if (!specialty) return null;
  const key = `settings.careTeam.specialties.${specialty}`;
  const label = t(key);
  return label === key ? specialty : label;
}

export const SPECIALTIES = [
  "general",
  "orthopedics",
  "dentistry",
  "cardiology",
  "pediatrics",
  "dermatology",
  "neurology",
  "obgyn",
  "ophthalmology",
  "ent",
  "psychiatry",
  "radiology",
  "anesthesiology",
  "surgery",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];
