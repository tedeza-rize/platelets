import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { isSetupComplete } from "@/lib/setup-state";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) {
    redirect("/");
  }

  return <SetupWizard />;
}
