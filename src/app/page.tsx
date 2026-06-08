import { headers } from "next/headers";
import { MapShell } from "@/components/map-shell";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function Home() {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));
  const dictionary = getDictionary(locale);
  const vworldApiKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? "";

  return (
    <MapShell
      dictionary={dictionary}
      initialProvider="vworld"
      vworldApiKey={vworldApiKey}
    />
  );
}
