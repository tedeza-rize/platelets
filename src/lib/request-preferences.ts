import { cookies, headers } from "next/headers";
import { type Locale, resolveLocale } from "@/lib/i18n";
import {
  LOCALE_COOKIE,
  resolveLocalePreference,
  resolveThemePreference,
  THEME_COOKIE,
  type ThemeMode,
} from "@/lib/preferences";

export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return (
    resolveLocalePreference(cookieStore.get(LOCALE_COOKIE)?.value) ??
    resolveLocale(headerList.get("accept-language"))
  );
}

export async function getRequestTheme(): Promise<ThemeMode> {
  return resolveThemePreference((await cookies()).get(THEME_COOKIE)?.value);
}
