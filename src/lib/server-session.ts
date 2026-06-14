import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type AccessRole, canAccessRole } from "@/lib/access-control";
import { getAccessSession, SESSION_COOKIE_NAME } from "@/lib/auth-sessions";
import { homePathForRole } from "@/lib/role-routing";

export async function getCurrentAccessSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";

  return getAccessSession(token);
}

export async function requirePageRole(role: AccessRole) {
  const session = await getCurrentAccessSession();

  if (!session) {
    redirect("/login");
  }

  if (!canAccessRole(session.role, role)) {
    redirect(homePathForRole(session.role));
  }

  return session;
}
