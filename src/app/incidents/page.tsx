import { headers } from "next/headers";
import { LazyDisasterDashboard } from "@/components/lazy-disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function IncidentListPage() {
  await requireSetupComplete();
  const headerList = await headers();
  const dashboardConfig = await getDisasterDashboardConfig();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <LazyDisasterDashboard
      dictionary={dictionary}
      initialView="incidents"
      {...dashboardConfig}
    />
  );
}
