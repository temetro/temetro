import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { clinicSettings } from "../db/schema/clinic-settings.js";

export type ClinicLocation = {
  address: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type ClinicSettingsView = {
  location: ClinicLocation;
};

const EMPTY_LOCATION: ClinicLocation = {
  address: "",
  city: "",
  country: "",
  latitude: null,
  longitude: null,
};

type ClinicSettingsRow = typeof clinicSettings.$inferSelect;

function toView(row: ClinicSettingsRow | undefined): ClinicSettingsView {
  if (!row) return { location: { ...EMPTY_LOCATION } };
  return {
    location: {
      address: row.address,
      city: row.city,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
    },
  };
}

// Read a clinic's settings. Returns empty defaults when no row exists yet, so
// the panel always renders.
export async function getClinicSettings(
  orgId: string,
): Promise<ClinicSettingsView> {
  const [row] = await db
    .select()
    .from(clinicSettings)
    .where(eq(clinicSettings.organizationId, orgId))
    .limit(1);
  return toView(row);
}

// Upsert the clinic's location (address + optional coordinates).
export async function setClinicLocation(
  orgId: string,
  location: ClinicLocation,
): Promise<ClinicSettingsView> {
  const values = {
    organizationId: orgId,
    address: location.address,
    city: location.city,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
  };
  const [row] = await db
    .insert(clinicSettings)
    .values(values)
    .onConflictDoUpdate({
      target: clinicSettings.organizationId,
      set: {
        address: values.address,
        city: values.city,
        country: values.country,
        latitude: values.latitude,
        longitude: values.longitude,
      },
    })
    .returning();
  return toView(row);
}
