import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { NotificationControl } from "@/components/notification-control";
import { PreferenceControl } from "@/components/preference-control";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { TimeSkewGuard } from "@/components/time-skew-guard";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale, getRequestTheme } from "@/lib/request-preferences";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return getDictionary(await getRequestLocale()).metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, theme] = await Promise.all([
    getRequestLocale(),
    getRequestTheme(),
  ]);
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-theme={theme === "system" ? undefined : theme}
      suppressHydrationWarning
    >
      <body>
        {children}
        <ServiceWorkerRegistration />
        <PreferenceControl
          dictionary={dictionary}
          initialLocale={locale}
          initialTheme={theme}
        />
        <NotificationControl dictionary={dictionary} />
        <TimeSkewGuard dictionary={dictionary} />
      </body>
    </html>
  );
}
