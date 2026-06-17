import { LicenseBrowser } from "@/components/licenses/license-browser";
import { DATA_LICENSE_ENTRIES } from "@/lib/data-licenses";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());

  return (
    <LicenseBrowser dictionary={dictionary} entries={DATA_LICENSE_ENTRIES} />
  );
}
