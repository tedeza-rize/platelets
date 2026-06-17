import { ManagementConsole } from "@/components/admin/management-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminPage(props: { searchParams: SearchParams }) {
  await requireSetupComplete();

  const searchParams = await props.searchParams;
  const tab =
    typeof searchParams.tab === "string" ? searchParams.tab : undefined;

  const dictionary = getDictionary(await getRequestLocale());

  return (
    <ManagementConsole
      dictionary={dictionary}
      mode="admin"
      hasSudoSession={false}
      tab={tab}
    />
  );
}
