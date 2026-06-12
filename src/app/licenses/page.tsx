import { headers } from "next/headers";
import { LicenseBrowser } from "@/components/license-browser";
import { DATA_LICENSE_ENTRIES } from "@/lib/data-licenses";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  await requireSetupComplete();

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <LicenseBrowser dictionary={dictionary} entries={DATA_LICENSE_ENTRIES} />
  );
}
