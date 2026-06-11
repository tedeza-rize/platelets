import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MapShell } from "@/components/map-shell";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getRuntimeApiKeys } from "@/lib/runtime-config";
import { isSetupComplete } from "@/lib/setup-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));
  const dictionary = getDictionary(locale);
  const { vworldApiKey } = await getRuntimeApiKeys();

  return (
    <MapShell
      dictionary={dictionary}
      initialProvider="vworld"
      vworldApiKey={vworldApiKey}
    />
  );
}
