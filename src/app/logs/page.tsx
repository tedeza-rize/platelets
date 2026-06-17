import { LogConsole } from "@/components/admin/log-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());

  return <LogConsole dictionary={dictionary} />;
}
