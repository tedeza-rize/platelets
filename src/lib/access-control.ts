import { getAccessSessionRole, SESSION_COOKIE_NAME } from "@/lib/auth-sessions";
import { noStoreJson } from "@/lib/http";

export type AccessRole = "admin" | "sudo";

export const ACCESS_TOKEN_HEADER = "x-platelets-admin-token";

const ACCESS_ROLE_LEVEL = {
  admin: 1,
  sudo: 2,
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
  const token = requestToken(request);

  if (!token) {
    return null;
  }

  return getAccessSessionRole(token);
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
  const actualRole = await getRequestAccessRole(request);

  if (!actualRole) {
    return noStoreJson(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  if (!canAccessRole(actualRole, requiredRole)) {
    return noStoreJson({ error: "Insufficient permissions." }, { status: 403 });
  }

  return null;
}
