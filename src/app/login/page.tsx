import { redirect } from "next/navigation";
import { LoginConsole } from "@/components/login-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { homePathForRole } from "@/lib/role-routing";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  await requireSetupComplete();
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "";

  const session = await getCurrentAccessSession();
  if (session) {
    redirect(next || homePathForRole(session.role));
  }

  const dictionary = getDictionary(await getRequestLocale());

  return <LoginConsole dictionary={dictionary} next={next} />;
}
