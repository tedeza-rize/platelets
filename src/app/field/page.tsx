import { headers } from "next/headers";
import { FieldConsole } from "@/components/field-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requirePageRole } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  await requireSetupComplete();
  await requirePageRole("field_worker");
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <FieldConsole dictionary={dictionary} />;
}
