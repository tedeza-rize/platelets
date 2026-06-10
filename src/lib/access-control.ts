import { timingSafeEqual } from "node:crypto";
import { noStoreJson } from "@/lib/http";

export type AccessRole = "admin" | "sudo";

export const ACCESS_TOKEN_HEADER = "x-platelets-admin-token";

const ACCESS_ROLE_LEVEL = {
  admin: 1,
  sudo: 2,
} as const satisfies Record<AccessRole, number>;

function configuredToken(role: AccessRole) {
  const value =
    role === "sudo"
      ? process.env.PLATELETS_SUDO_TOKEN
      : process.env.PLATELETS_ADMIN_TOKEN;

  return value?.trim() ?? "";
}

function requestToken(request: Request) {
  const explicitToken = request.headers.get(ACCESS_TOKEN_HEADER)?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";

  return authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length).trim()
    : "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getRequestAccessRole(request: Request): AccessRole | null {
  const token = requestToken(request);

  if (!token) {
    return null;
  }

  const sudoToken = configuredToken("sudo");

  if (sudoToken && safeEqual(token, sudoToken)) {
    return "sudo";
  }

  const adminToken = configuredToken("admin");

  if (adminToken && safeEqual(token, adminToken)) {
    return "admin";
  }

  return null;
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

export function requireAccessRole(request: Request, requiredRole: AccessRole) {
  const hasRequiredToken =
    requiredRole === "sudo"
      ? Boolean(configuredToken("sudo"))
      : Boolean(configuredToken("admin") || configuredToken("sudo"));

  if (!hasRequiredToken) {
    return noStoreJson(
      { error: `${requiredRole} access token is not configured.` },
      { status: 503 },
    );
  }

  const actualRole = getRequestAccessRole(request);

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
