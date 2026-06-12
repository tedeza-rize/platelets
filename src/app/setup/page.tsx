import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { isSetupComplete } from "@/lib/setup-state";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) {
    redirect("/");
  }

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <SetupWizard dictionary={dictionary} />;
}
