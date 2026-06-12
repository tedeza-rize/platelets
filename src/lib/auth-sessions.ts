import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AccessRole } from "@/lib/access-control";
import { getAppSetting, setAppSetting } from "@/lib/points-db";
import { getStoredAccessRole } from "@/lib/setup-state";

export const SESSION_COOKIE_NAME = "platelets_session";

type StoredAccessSession = {
  createdAt: string;
  expiresAt: string;
  role: AccessRole;
  tokenHash: string;
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

  return sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now,
  );
}

async function writeSessions(sessions: StoredAccessSession[]) {
  await setAppSetting(SESSION_SETTINGS_KEY, sessions);
}

export async function createAccessSession(password: string) {
  const role = await getStoredAccessRole(password);

  if (!role) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: StoredAccessSession = {
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    role,
    tokenHash: hashToken(token),
  };
  const sessions = await readSessions();
  sessions.push(session);
  await writeSessions(sessions);

  return { expiresAt: session.expiresAt, role, token };
}

export async function getAccessSessionRole(token: string) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const sessions = await readSessions();
  const session = sessions.find((candidate) =>
    safeEqual(candidate.tokenHash, tokenHash),
  );

  return session?.role ?? null;
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
