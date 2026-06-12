import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { TimeSkewGuard } from "@/components/time-skew-guard";
import { getDictionary, resolveLocale } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));

  return getDictionary(locale).metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {children}
        <TimeSkewGuard dictionary={dictionary} />
      </body>
    </html>
  );
}
