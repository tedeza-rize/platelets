import { headers } from "next/headers";
import { AiQueryConsole } from "@/components/ai-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  await requireSetupComplete();

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <AiQueryConsole dictionary={dictionary} />;
}
