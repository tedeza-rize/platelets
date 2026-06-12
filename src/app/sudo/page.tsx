import { headers } from "next/headers";
import { ManagementConsole } from "@/components/management-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function SudoPage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <ManagementConsole dictionary={dictionary} mode="sudo" />;
}
