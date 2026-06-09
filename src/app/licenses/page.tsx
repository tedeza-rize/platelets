import { LicenseBrowser } from "@/components/license-browser";
import { DATA_LICENSE_ENTRIES } from "@/lib/data-licenses";

export default function LicensesPage() {
  return <LicenseBrowser entries={DATA_LICENSE_ENTRIES} />;
}
