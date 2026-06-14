import { createAccessSession, SESSION_COOKIE_NAME } from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { homePathForRole } from "@/lib/role-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    password?: unknown;
    username?: unknown;
  } | null;
  const password = String(payload?.password ?? "");
  const username =
    typeof payload?.username === "string" ? payload.username : "";
  const normalizedUsername =
    username.trim().toLowerCase().slice(0, 40) || "legacy";
  const globalLimit = enforceRateLimit(request, {
    bucket: "auth-login-global",
    limit: 30,
    windowMs: 60_000,
  });
  if (globalLimit) return globalLimit;

  const accountLimit = enforceRateLimit(request, {
    bucket: `auth-login-account:${normalizedUsername}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (accountLimit) return accountLimit;

  const session = await createAccessSession(password, username);

  if (!session) {
    return noStoreJson({ error: "Invalid password." }, { status: 401 });
  }

  return noStoreJson(
    {
      expiresAt: session.expiresAt,
      homePath: homePathForRole(session.role),
      name: session.name,
      role: session.role,
      username: session.username,
    },
    {
      headers: {
        "Set-Cookie": `${SESSION_COOKIE_NAME}=${encodeURIComponent(
          session.token,
        )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      },
    },
  );
}
