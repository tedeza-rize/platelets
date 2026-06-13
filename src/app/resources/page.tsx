import { LazyDisasterDashboard } from "@/components/lazy-disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function ResourceRecommendationPage() {
  await requireSetupComplete();
  const dashboardConfig = await getDisasterDashboardConfig();

  return <LazyDisasterDashboard initialView="resources" {...dashboardConfig} />;
}
