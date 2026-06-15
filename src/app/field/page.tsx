import { FieldConsole } from "@/components/field-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requirePageRole } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  await requireSetupComplete();
  await requirePageRole("field_worker");
  const dictionary = getDictionary(await getRequestLocale());

  return <FieldConsole dictionary={dictionary} />;
}
