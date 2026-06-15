import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { getRequestLocale } from "@/lib/request-preferences";
import {
  getSetupEnvironmentStatus,
  isSetupCompleteFromDatabaseFile,
} from "@/lib/setup-environment";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupCompleteFromDatabaseFile()) {
    redirect("/");
  }

  const locale = await getRequestLocale();

  return (
    <SetupWizard
      initialLocale={locale}
      initialStatus={{
        environment: await getSetupEnvironmentStatus(),
        installed: false,
      }}
    />
  );
}
