import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginConsole } from "@/components/login-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { homePathForRole } from "@/lib/role-routing";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await requireSetupComplete();
  const session = await getCurrentAccessSession();
  if (session) redirect(homePathForRole(session.role));

  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return <LoginConsole dictionary={dictionary} />;
}
