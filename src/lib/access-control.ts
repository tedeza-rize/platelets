import {
  type AccessSession,
  getAccessSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";
import { fail, type GoResult, ok } from "@/shared/result";

export type AccessRole = "admin" | "dispatcher" | "field_worker" | "sudo";

export const ACCESS_TOKEN_HEADER = "x-platelets-admin-token";

const ACCESS_ROLE_LEVEL = {
  field_worker: 1,
  dispatcher: 2,
  admin: 3,
  sudo: 4,
} as const satisfies Record<AccessRole, number>;

function requestToken(request: Request) {
  const explicitToken = request.headers.get(ACCESS_TOKEN_HEADER)?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";

  return authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length).trim()
    : requestCookie(request, SESSION_COOKIE_NAME);
}

function requestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

export async function getRequestAccessRole(
  request: Request,
): Promise<AccessRole | null> {
  return (await getRequestAccessSession(request))?.role ?? null;
}

export async function getRequestAccessSession(request: Request) {
  const token = requestToken(request);

  if (!token) {
    return null;
  }

  return getAccessSession(token);
}

export function canAccessRole(
  actualRole: AccessRole | null,
  requiredRole: AccessRole,
) {
  return (
    actualRole !== null &&
    ACCESS_ROLE_LEVEL[actualRole] >= ACCESS_ROLE_LEVEL[requiredRole]
  );
}

export async function requireAccessRole(
  request: Request,
  requiredRole: AccessRole,
) {
  const [_session, forbidden] = await requireAccessSession(
    request,
    requiredRole,
  );
  return forbidden;
}

export async function requireAccessSession(
  request: Request,
  requiredRole: AccessRole,
): Promise<GoResult<AccessSession, Response>> {
  const session = await getRequestAccessSession(request);

  if (!session) {
    return fail(
      noStoreJson({ error: "Authentication is required." }, { status: 401 }),
    );
  }

  if (!canAccessRole(session.role, requiredRole)) {
    return fail(
      noStoreJson({ error: "Insufficient permissions." }, { status: 403 }),
    );
  }

  return ok(session);
}
