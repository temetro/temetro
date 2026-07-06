// Client for clinic-level (organization) settings — currently the clinic's
// location (Settings → Signing → Location). Calls the backend over the shared
// fetch wrapper (session cookie sent automatically).

import { apiFetch } from "@/lib/api-client";

export type ClinicLocation = {
  address: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type ClinicSettings = {
  location: ClinicLocation;
};

// The clinic's settings. Readable by any clinician; returns empty defaults when
// nothing has been set yet.
export async function getClinicSettings(): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>("/api/clinic/settings");
}

// Save the clinic's location (owner/admin only). Returns the updated settings.
export async function saveClinicLocation(
  location: ClinicLocation,
): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>("/api/clinic/location", {
    method: "PUT",
    body: JSON.stringify(location),
  });
}
