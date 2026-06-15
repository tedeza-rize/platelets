import { LazyDisasterDashboard } from "@/components/lazy-disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function IncidentListPage() {
  await requireSetupComplete();
  const dashboardConfig = await getDisasterDashboardConfig();
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <LazyDisasterDashboard
      dictionary={dictionary}
      initialView="incidents"
      {...dashboardConfig}
    />
  );
}
