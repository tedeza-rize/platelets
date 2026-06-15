import { ManagementConsole } from "@/components/management-console";
import { getDatabaseConfig } from "@/lib/database/config";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function SudoPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());

  return (
    <ManagementConsole
      currentDatabaseEngine={getDatabaseConfig().engine}
      dictionary={dictionary}
      mode="sudo"
    />
  );
}
