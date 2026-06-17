import { ErrorState } from "@/components/feedback/error-state";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const dictionary = getDictionary(await getRequestLocale());
  return <ErrorState dictionary={dictionary} kind="maintenance" />;
}
