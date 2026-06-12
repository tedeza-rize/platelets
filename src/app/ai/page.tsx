import { headers } from "next/headers";
import { AiQueryConsole } from "@/components/ai-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function AiPage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <AiQueryConsole dictionary={dictionary} />;
}
