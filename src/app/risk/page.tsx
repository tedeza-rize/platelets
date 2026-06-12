import { DisasterDashboard } from "@/components/disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function RiskMapPage() {
  await requireSetupComplete();
  const dashboardConfig = await getDisasterDashboardConfig();

  return <DisasterDashboard initialView="risk" {...dashboardConfig} />;
}
