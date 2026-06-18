import { redirect } from "next/navigation";
import { ManagementConsole } from "@/components/admin/management-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { getCurrentAccessSession } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function SudoPage(props: { searchParams: SearchParams }) {
  await requireSetupComplete();

  const searchParams = await props.searchParams;
  const tab =
    typeof searchParams.tab === "string" ? searchParams.tab : undefined;
  const section =
    typeof searchParams.section === "string" ? searchParams.section : undefined;

  const dictionary = getDictionary(await getRequestLocale());
  const session = await getCurrentAccessSession();

  if (session?.role !== "sudo") {
    redirect("/forbidden");
  }

  return (
    <ManagementConsole
      dictionary={dictionary}
      mode="sudo"
      hasSudoSession={true}
      section={section}
      tab={tab}
    />
  );
}
