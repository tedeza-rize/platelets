import { headers } from "next/headers";
import { UserAdminConsole } from "@/components/user-admin-console";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { requirePageRole } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireSetupComplete();
  const session = await requirePageRole("admin");
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <UserAdminConsole
      currentUserId={session.userId ?? ""}
      dictionary={dictionary}
      viewerRole={session.role === "sudo" ? "sudo" : "admin"}
    />
  );
}
