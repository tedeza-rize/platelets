import { headers } from "next/headers";
import { MapShell } from "@/components/map-shell";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function Home() {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));
  const dictionary = getDictionary(locale);

  return <MapShell dictionary={dictionary} initialProvider="vworld" />;
}
