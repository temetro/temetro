import { apiFetch } from "@/lib/api-client";

// Per-user preferences persisted by the backend (`user_settings` table) as a
// flat key → boolean/string map. Unknown keys are preserved, so features can
// add settings without coordinating with this file.
export type UserPreferences = Record<string, boolean | string>;

export async function getSettings(): Promise<UserPreferences> {
  const res = await apiFetch<{ preferences: UserPreferences }>("/api/settings");
  return res.preferences ?? {};
}

export async function saveSettings(
  preferences: UserPreferences,
): Promise<UserPreferences> {
  const res = await apiFetch<{ preferences: UserPreferences }>(
    "/api/settings",
    {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    },
  );
  return res.preferences ?? {};
}
