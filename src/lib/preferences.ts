import type { Locale } from "@/lib/i18n";

export const LOCALE_COOKIE = "platelets-locale";
export const THEME_COOKIE = "platelets-theme";

export type ThemeMode = "dark" | "light" | "system";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

export function resolveLocalePreference(
  value: string | undefined,
): Locale | null {
  return value === "ko" || value === "en" ? value : null;
}

export function resolveThemePreference(value: string | undefined): ThemeMode {
  return isThemeMode(value) ? value : "system";
}
