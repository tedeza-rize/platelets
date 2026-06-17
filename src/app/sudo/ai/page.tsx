import { AiSettingsConsole } from "@/components/ai/ai-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requireSetupComplete();

  const dictionary = getDictionary(await getRequestLocale());

  return <AiSettingsConsole dictionary={dictionary} />;
}
