import { redirect } from "next/navigation";
import { ManagementConsole } from "@/components/management-console";
import { getDatabaseConfig } from "@/lib/database/config";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function SudoPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());
  const session = await getCurrentAccessSession();

  if (session?.role !== "sudo") {
    redirect("/forbidden");
  }

  return (
    <ManagementConsole
      currentDatabaseEngine={getDatabaseConfig().engine}
      dictionary={dictionary}
      mode="sudo"
      hasSudoSession={true}
    />
  );
}
