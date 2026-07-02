"use client";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";
import so from "./locales/so/translation.json";
import ar from "./locales/ar/translation.json";
import de from "./locales/de/translation.json";

export const defaultNS = "translation";

// Add new languages here (and a matching JSON under locales/<lng>/translation.json).
export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  so: { translation: so },
  ar: { translation: ar },
  de: { translation: de },
} as const;

// Languages offered in the Settings → Profile switcher (label rendered there).
export const supportedLanguages = ["en", "fr", "so", "ar", "de"] as const;

// Right-to-left languages. Arabic is our only RTL locale today; keep this and the
// inline <head> script in app/layout.tsx (which can't import this module) in sync.
export const rtlLanguages = ["ar"] as const;

/** Writing direction for a BCP-47 language tag (e.g. "ar", "ar-SA"). */
export const dirFor = (lng: string | undefined): "rtl" | "ltr" =>
  lng && rtlLanguages.some((r) => lng.startsWith(r)) ? "rtl" : "ltr";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      fallbackLng: "en",
      // Keep this in sync with `resources` as languages grow.
      supportedLngs: ["en", "fr", "so", "ar", "de"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
      },
    });
}

export default i18n;
