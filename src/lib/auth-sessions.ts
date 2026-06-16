import { createHash, randomBytes } from "node:crypto";
import type { AccessRole } from "@/lib/access-control";
import {
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import type { DatabaseClient } from "@/lib/database/types";
import { getDatabase, withDatabaseWriteTransaction } from "@/lib/points-db";
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
let legacyMigrationPromise: Promise<void> | null = null;

type AccessSessionRow = {
  created_at: string;
  expires_at: string;
  name: string;
  role: AccessRole;
  token_hash: string;
  user_id: string | null;
  username: string | null;
};

type AppSettingRow = {
  value_json: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export type AccessSession = Omit<StoredAccessSession, "tokenHash">;

function mapSession(row: AccessSessionRow): AccessSession {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    name: row.name,
    role: row.role,
    userId: row.user_id,
    username: row.username,
  };
}

function parseLegacySessions(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as StoredAccessSession[]) : [];
  } catch {
    return [];
  }
}

async function insertStoredSession(
  db: DatabaseClient,
  session: StoredAccessSession,
) {
  await run(
    db,
    `INSERT INTO access_sessions (
      token_hash,
      user_id,
      username,
      role,
      name,
      created_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET
      user_id = excluded.user_id,
      username = excluded.username,
      role = excluded.role,
      name = excluded.name,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at`,
    [
      session.tokenHash,
      session.userId,
      session.username,
      session.role,
      session.name,
      session.createdAt,
      session.expiresAt,
    ],
  );
}

async function ensureLegacySessionsMigrated() {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = withDatabaseWriteTransaction(async (db) => {
      const row = await get<AppSettingRow>(
        db,
        "SELECT value_json FROM app_settings WHERE key = ?",
        [SESSION_SETTINGS_KEY],
      );

      if (!row) {
        return;
      }

      const now = Date.now();
      const sessions = parseLegacySessions(row.value_json);

      for (const session of sessions) {
        if (new Date(session.expiresAt).getTime() <= now) continue;

        await insertStoredSession(db, {
          ...session,
          name: session.name ?? (session.role === "sudo" ? "sudo" : "admin"),
          userId: session.userId ?? null,
          username: session.username ?? null,
        });
      }

      await run(db, "DELETE FROM app_settings WHERE key = ?", [
        SESSION_SETTINGS_KEY,
      ]);
    });
  }

  await legacyMigrationPromise;
}

async function deleteExpiredSessions(db: DatabaseClient, now: string) {
  await run(db, "DELETE FROM access_sessions WHERE expires_at <= ?", [now]);
}

export async function createAccessSession(password: string, username = "") {
  const hasUsername = username.trim().length > 0;
  const user = hasUsername ? await authenticateUser(username, password) : null;
  const role = hasUsername
    ? (user?.role ?? null)
    : await getStoredAccessRole(password);

  if (!role) {
    return null;
  }

  await ensureLegacySessionsMigrated();

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
  await withDatabaseWriteTransaction(async (db) => {
    await deleteExpiredSessions(db, session.createdAt);
    await insertStoredSession(db, session);
  });

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

  await ensureLegacySessionsMigrated();

  const tokenHash = hashToken(token);
  const db = await getDatabase();
  const session = await get<AccessSessionRow>(
    db,
    `SELECT *
       FROM access_sessions
      WHERE token_hash = ?
        AND expires_at > ?`,
    [tokenHash, new Date().toISOString()],
  );

  if (!session) return null;
  return mapSession(session);
}

export async function getAccessSessionRole(token: string) {
  return (await getAccessSession(token))?.role ?? null;
}

export async function revokeAccessSession(token: string) {
  if (!token) {
    return;
  }

  await ensureLegacySessionsMigrated();

  const tokenHash = hashToken(token);
  await withDatabaseWriteTransaction(async (db) =>
    run(db, "DELETE FROM access_sessions WHERE token_hash = ?", [tokenHash]),
  );
}

export async function revokeUserAccessSessions(userId: string) {
  if (!userId) {
    return;
  }

  await ensureLegacySessionsMigrated();

  await withDatabaseWriteTransaction(async (db) =>
    run(db, "DELETE FROM access_sessions WHERE user_id = ?", [userId]),
  );
}
