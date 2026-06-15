import { ManagementConsole } from "@/components/management-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function SudoPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());

  return <ManagementConsole dictionary={dictionary} mode="sudo" />;
}
