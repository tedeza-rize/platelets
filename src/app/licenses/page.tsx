import { headers } from "next/headers";
import { LicenseBrowser } from "@/components/license-browser";
import { DATA_LICENSE_ENTRIES } from "@/lib/data-licenses";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LicensesPage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <LicenseBrowser dictionary={dictionary} entries={DATA_LICENSE_ENTRIES} />
  );
}
