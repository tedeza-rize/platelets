import { type NextRequest, NextResponse } from "next/server";
import {
  LOCALE_COOKIE,
  resolveLocalePreference,
  resolveThemePreference,
  THEME_COOKIE,
} from "@/lib/preferences";

const COOKIE_MAX_AGE = 31_536_000;

type PreferenceBody = {
  locale?: string;
  theme?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request
    .json()
    .catch(() => null)) as PreferenceBody | null;
  if (!body) return NextResponse.json(null, { status: 400 });

  const locale = resolveLocalePreference(body.locale);
  const theme = body.theme ? resolveThemePreference(body.theme) : null;
  if (!(locale || theme)) return NextResponse.json(null, { status: 400 });

  const response = new NextResponse(null, { status: 204 });
  const options = {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
  };

  if (locale) response.cookies.set(LOCALE_COOKIE, locale, options);
  if (theme) response.cookies.set(THEME_COOKIE, theme, options);
  return response;
}
