import { headers } from "next/headers";
import { LogConsole } from "@/components/log-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LogsPage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <LogConsole dictionary={dictionary} />;
}
