import { ErrorState } from "@/components/feedback/error-state";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";

export default async function NotFound() {
  const dictionary = getDictionary(await getRequestLocale());
  return <ErrorState dictionary={dictionary} kind="notFound" />;
}
