import { UserAdminConsole } from "@/components/user-admin-console";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";
import { requirePageRole } from "@/lib/server-session";
import { requireSetupComplete } from "@/lib/setup-redirect";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireSetupComplete();
  const session = await requirePageRole("admin");
  const dictionary = getDictionary(await getRequestLocale());

  return (
    <UserAdminConsole
      currentUserId={session.userId ?? ""}
      dictionary={dictionary}
      viewerRole={session.role === "sudo" ? "sudo" : "admin"}
    />
  );
}
