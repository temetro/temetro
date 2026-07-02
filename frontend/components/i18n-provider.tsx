"use client";

import { useEffect } from "react";
import type * as React from "react";
import { I18nextProvider } from "react-i18next";

import i18n, { dirFor } from "@/lib/i18n/config";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Keep <html lang/dir> in sync with the active language. The inline script in
  // app/layout.tsx sets these before first paint (avoiding an RTL flash); this
  // effect keeps them correct after hydration and on every language switch.
  useEffect(() => {
    const apply = (lng: string) => {
      const root = document.documentElement;
      root.lang = lng;
      root.dir = dirFor(lng);
    };
    apply(i18n.resolvedLanguage ?? i18n.language);
    i18n.on("languageChanged", apply);
    return () => {
      i18n.off("languageChanged", apply);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
