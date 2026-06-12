import { redirect } from "next/navigation";
import { DisasterDashboard } from "@/components/disaster-dashboard";
import { isSetupComplete } from "@/lib/setup-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  return <DisasterDashboard initialView="dashboard" />;
}
