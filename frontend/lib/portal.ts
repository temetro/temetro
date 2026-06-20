// Client for the public Patient Portal kiosk API (backend src/routes/portal.ts).
// Unlike lib/api-client, these calls are unauthenticated (no session cookie) and
// must NOT bounce to /login on error — the kiosk has no login.

import { API_BASE_URL } from "@/lib/api-client";

export type PortalClinic = { name: string };

export type PortalBooking = {
  fileNumber: string;
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type?: string;
};

export type PortalBookingResult = {
  date: string;
  time: string;
  type: string;
  provider: string;
};

export type PortalResults = {
  name: string;
  upcoming: {
    date: string;
    time: string;
    type: string;
    provider: string;
    status: string;
  }[];
  hasResults: boolean;
  resultCount: number;
};

export class PortalError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PortalError";
  }
}

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/portal${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new PortalError(
      res.status,
      body?.error ?? `Request failed (${res.status}).`,
    );
  }
  return body as T;
}

export function getPortalClinic(clinic: string): Promise<PortalClinic> {
  return portalFetch<PortalClinic>(`/${encodeURIComponent(clinic)}`);
}

export function bookPortalAppointment(
  clinic: string,
  booking: PortalBooking,
): Promise<PortalBookingResult> {
  return portalFetch<PortalBookingResult>(
    `/${encodeURIComponent(clinic)}/appointments`,
    { method: "POST", body: JSON.stringify(booking) },
  );
}

export function lookupPortalResults(
  clinic: string,
  fileNumber: string,
  name: string,
): Promise<PortalResults> {
  const qs = new URLSearchParams({ fileNumber, name }).toString();
  return portalFetch<PortalResults>(
    `/${encodeURIComponent(clinic)}/results?${qs}`,
  );
}
