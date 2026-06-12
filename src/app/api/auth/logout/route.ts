import { revokeAccessSession, SESSION_COOKIE_NAME } from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

export async function POST(request: Request) {
  await revokeAccessSession(requestCookie(request, SESSION_COOKIE_NAME));

  return noStoreJson(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      },
    },
  );
}
