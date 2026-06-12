import { headers } from "next/headers";
import { ManagementConsole } from "@/components/management-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function SudoPage() {
  await requireSetupComplete();

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <ManagementConsole dictionary={dictionary} mode="sudo" />;
}
