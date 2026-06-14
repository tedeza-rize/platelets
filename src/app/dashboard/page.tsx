import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LazyDisasterDashboard } from "@/components/lazy-disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSetupComplete();
  const session = await getCurrentAccessSession();
  if (session?.role === "field_worker") redirect("/field");

  const headerList = await headers();
  const dashboardConfig = await getDisasterDashboardConfig();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <LazyDisasterDashboard
      dictionary={dictionary}
      initialView="dashboard"
      {...dashboardConfig}
    />
  );
}
