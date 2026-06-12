import { createAccessSession, SESSION_COOKIE_NAME } from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "auth-login",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = String(payload?.password ?? "");
  const session = await createAccessSession(password);

  if (!session) {
    return noStoreJson({ error: "Invalid password." }, { status: 401 });
  }

  return noStoreJson(
    { expiresAt: session.expiresAt, role: session.role },
    {
      headers: {
        "Set-Cookie": `${SESSION_COOKIE_NAME}=${encodeURIComponent(
          session.token,
        )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      },
    },
  );
}
