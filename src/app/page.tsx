import { redirect } from "next/navigation";
import { LazyDisasterDashboard } from "@/components/lazy-disaster-dashboard";
import { getDisasterDashboardConfig } from "@/lib/disaster-dashboard-config";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireSetupComplete();

  const session = await getCurrentAccessSession();
  if (
    !(
      session &&
      ["sudo", "admin", "dispatcher", "field_worker"].includes(session.role)
    )
  ) {
    redirect("/login?next=/");
  }

  const dashboardConfig = await getDisasterDashboardConfig();
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <LazyDisasterDashboard
      dictionary={dictionary}
      initialView="dashboard"
      {...dashboardConfig}
    />
  );
}
