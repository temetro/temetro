import i18n, { supportedLanguages } from "@/lib/i18n/config";
import { getSettings, saveSettings } from "@/lib/settings";

// The user's chosen UI language roams across devices via the backend
// `user_settings` preferences map (localStorage stays the offline source of
// truth). We store it under this key alongside notification preferences.
const LANG_KEY = "language";

const isSupported = (value: unknown): value is string =>
  typeof value === "string" &&
  (supportedLanguages as readonly string[]).includes(value);

/**
 * Persist the chosen language to the backend, merging into existing preferences
 * so notification toggles aren't clobbered (PUT replaces the whole map).
 * Best-effort: failures are swallowed since localStorage already holds the choice.
 */
export async function persistLanguage(lang: string): Promise<void> {
  try {
    const current = await getSettings();
    if (current[LANG_KEY] === lang) return;
    await saveSettings({ ...current, [LANG_KEY]: lang });
  } catch {
    // Ignore — the language is already applied and cached in localStorage.
  }
}

/**
 * On app load, adopt the language saved on the backend if it differs from the
 * locally detected one (roaming to a new device). No-op when offline or when the
 * stored value matches; localStorage remains authoritative otherwise.
 */
export async function applyStoredLanguage(): Promise<void> {
  try {
    const current = await getSettings();
    const lang = current[LANG_KEY];
    if (isSupported(lang) && lang !== (i18n.resolvedLanguage ?? i18n.language)) {
      await i18n.changeLanguage(lang);
    }
  } catch {
    // Ignore — unauthenticated or offline; keep the detected language.
  }
}
