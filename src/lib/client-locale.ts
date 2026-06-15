"use client";

import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resolveThemePreference, type ThemeMode } from "@/lib/preferences";

export function useClientDictionary() {
  const [locale, setLocale] = useState<Locale>("ko");
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    const storedLocale = localStorage.getItem("platelets-locale");
    setLocale(
      storedLocale === "en" || document.documentElement.lang === "en"
        ? "en"
        : "ko",
    );
    setTheme(
      resolveThemePreference(
        localStorage.getItem("platelets-theme") ?? undefined,
      ),
    );
  }, []);

  return { dictionary: getDictionary(locale), locale, theme };
}
