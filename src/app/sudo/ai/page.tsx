import { headers } from "next/headers";
import { AiSettingsConsole } from "@/components/ai-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function AiSettingsPage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <AiSettingsConsole dictionary={dictionary} />;
}
