import { SESSION_COOKIE_NAME } from "@/lib/auth-sessions";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function forwardedProto(request: Request) {
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
}

export function isSecureSessionRequest(request: Request) {
  return (
    new URL(request.url).protocol === "https:" ||
    forwardedProto(request) === "https" ||
    process.env.PLATELETS_FORCE_SECURE_COOKIES === "1"
  );
}

export function sessionCookieHeader(request: Request, token: string) {
  const secure = isSecureSessionRequest(request) ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookieHeader(request: Request) {
  const secure = isSecureSessionRequest(request) ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
