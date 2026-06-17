import { createAccessSession } from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";
import { homePathForRole } from "@/lib/role-routing";
import { sessionCookieHeader } from "@/lib/session-cookie";

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
  const globalLimit = await enforceSharedRateLimit(request, {
    bucket: "auth-login-global",
    limit: 30,
    windowMs: 60_000,
  });
  if (globalLimit) return globalLimit;

  const accountLimit = await enforceSharedRateLimit(request, {
    bucket: `auth-login-account:${normalizedUsername}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (accountLimit) return accountLimit;

  try {
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
          "Set-Cookie": sessionCookieHeader(request, session.token),
        },
      },
    );
  } catch (error) {
    console.error("Login failure:", error);
    return noStoreJson({ error: String(error) }, { status: 500 });
  }
}
