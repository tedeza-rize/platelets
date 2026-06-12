import { DisasterDashboard } from "@/components/disaster-dashboard";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function IncidentListPage() {
  await requireSetupComplete();

  return <DisasterDashboard initialView="incidents" />;
}
