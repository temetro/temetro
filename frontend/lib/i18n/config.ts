"use client";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

export const defaultNS = "translation";

// Add new languages here (and a matching JSON under locales/<lng>/translation.json).
export const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const;

// Languages offered in the Settings → Profile switcher (label rendered there).
export const supportedLanguages = ["en", "fr"] as const;

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      fallbackLng: "en",
      // Keep this in sync with `resources` as languages grow.
      supportedLngs: ["en", "fr"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
      },
    });
}

export default i18n;
