import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccessRole } from "@/lib/access-control";
import { getAppSetting, setAppSetting } from "@/lib/points-db";
import { getStoredAccessRole } from "@/lib/setup-state";
import { authenticateUser } from "@/lib/users";

export const SESSION_COOKIE_NAME = "platelets_session";

type StoredAccessSession = {
  createdAt: string;
  expiresAt: string;
  name: string;
  role: AccessRole;
  tokenHash: string;
  userId: string | null;
  username: string | null;
};

const SESSION_SETTINGS_KEY = "access-sessions";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function readSessions() {
  const now = Date.now();
  const sessions = await getAppSetting<StoredAccessSession[]>(
    SESSION_SETTINGS_KEY,
    [],
  );

  return sessions
    .filter((session) => new Date(session.expiresAt).getTime() > now)
    .map((session) => ({
      ...session,
      name: session.name ?? (session.role === "sudo" ? "sudo" : "admin"),
      userId: session.userId ?? null,
      username: session.username ?? null,
    }));
}

async function writeSessions(sessions: StoredAccessSession[]) {
  await setAppSetting(SESSION_SETTINGS_KEY, sessions);
}

export type AccessSession = Omit<StoredAccessSession, "tokenHash">;

export async function createAccessSession(password: string, username = "") {
  const user = username.trim()
    ? await authenticateUser(username, password)
    : null;
  const role = user?.role ?? (await getStoredAccessRole(password));

  if (!role) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: StoredAccessSession = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    name: user?.name ?? (role === "sudo" ? "sudo" : "admin"),
    role,
    tokenHash: hashToken(token),
    userId: user?.id ?? null,
    username: user?.username ?? null,
  };
  const sessions = await readSessions();
  sessions.push(session);
  await writeSessions(sessions);

  return {
    expiresAt: session.expiresAt,
    name: session.name,
    role,
    token,
    userId: session.userId,
    username: session.username,
  };
}

export async function getAccessSession(
  token: string,
): Promise<AccessSession | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const sessions = await readSessions();
  const session = sessions.find((candidate) =>
    safeEqual(candidate.tokenHash, tokenHash),
  );

  if (!session) return null;

  return {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    name: session.name,
    role: session.role,
    userId: session.userId,
    username: session.username,
  };
}

export async function getAccessSessionRole(token: string) {
  return (await getAccessSession(token))?.role ?? null;
}

export async function revokeAccessSession(token: string) {
  if (!token) {
    return;
  }

  const tokenHash = hashToken(token);
  const sessions = (await readSessions()).filter(
    (session) => !safeEqual(session.tokenHash, tokenHash),
  );
  await writeSessions(sessions);
}
