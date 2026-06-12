import { headers } from "next/headers";
import { AiSettingsConsole } from "@/components/ai-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requireSetupComplete();

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <AiSettingsConsole dictionary={dictionary} />;
}
