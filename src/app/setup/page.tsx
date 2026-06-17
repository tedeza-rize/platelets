import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { getDictionary } from "@/lib/i18n";
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
      setupDictionaries={{
        en: getDictionary("en").setup,
        ko: getDictionary("ko").setup,
      }}
    />
  );
}
