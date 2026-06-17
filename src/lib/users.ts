import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import { isPasswordValid } from "@/lib/password-policy";
import { getDatabase, withDatabaseWriteTransaction } from "@/lib/points-db";
import { fail, type GoResult, ok } from "@/shared/result";

export type UserRole = "admin" | "dispatcher" | "field_worker" | "sudo";

export type UserAccount = {
  createdAt: string;
  department: string;
  email: string;
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  updatedAt: string;
  username: string;
};

export type UserAccountInput = {
  department?: unknown;
  email?: unknown;
  name?: unknown;
  password?: unknown;
  phone?: unknown;
  role?: unknown;
  username?: unknown;
};

type UserRow = {
  created_at: string;
  department: string;
  email: string;
  id: string;
  name: string;
  password_hash: string;
  password_iterations: number;
  password_salt: string;
  phone: string;
  role: string;
  updated_at: string;
  username: string;
};

const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanUsername(value: unknown) {
  return cleanText(value, 40).toLowerCase();
}

function cleanRole(value: unknown): UserRole {
  return value === "sudo" ||
    value === "admin" ||
    value === "dispatcher" ||
    value === "field_worker"
    ? value
    : "field_worker";
}

function assertUsername(username: string) {
  if (!USERNAME_PATTERN.test(username)) {
    return {
      code: "invalid_username",
      message:
        "Username must be 3-40 lowercase letters, numbers, dots, hyphens, or underscores.",
    };
  }
  return null;
}

function assertEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { code: "invalid_email", message: "Email is invalid." };
  }
  return null;
}

function assertPassword(password: string) {
  if (!isPasswordValid(password)) {
    return {
      code: "invalid_password",
      message:
        "Password must be at least 12 characters and include lowercase, uppercase, number, and special characters.",
    };
  }
  return null;
}

function hashPassword(password: string) {
  const passwordSalt = randomBytes(16).toString("base64url");
  const passwordHash = pbkdf2Sync(
    password,
    passwordSalt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    "sha256",
  ).toString("base64url");

  return {
    passwordHash,
    passwordIterations: PASSWORD_ITERATIONS,
    passwordSalt,
  };
}

function verifyPassword(password: string, row: UserRow) {
  const expected = Buffer.from(row.password_hash, "base64url");
  const actual = pbkdf2Sync(
    password,
    row.password_salt,
    row.password_iterations,
    expected.length,
    "sha256",
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function mapUser(row: UserRow): UserAccount {
  return {
    createdAt: row.created_at,
    department: row.department,
    email: row.email,
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: cleanRole(row.role),
    updatedAt: row.updated_at,
    username: row.username,
  };
}

function normalizeInput(
  input: UserAccountInput,
  requirePassword: boolean,
): GoResult<
  {
    department: string;
    email: string;
    name: string;
    password: string;
    phone: string;
    role: UserRole;
    username: string;
  },
  { code: string; message: string }
> {
  const username = cleanUsername(input.username);
  const email = cleanText(input.email, 200).toLowerCase();
  const name = cleanText(input.name, 120);
  const password = String(input.password ?? "");

  const usernameError = assertUsername(username);
  if (usernameError) return fail(usernameError);

  const emailError = assertEmail(email);
  if (emailError) return fail(emailError);

  if (!name)
    return fail({ code: "missing_name", message: "Name is required." });

  if (requirePassword || password) {
    const passwordError = assertPassword(password);
    if (passwordError) return fail(passwordError);
  }

  return ok({
    department: cleanText(input.department, 120),
    email,
    name,
    password,
    phone: cleanText(input.phone, 80),
    role: cleanRole(input.role),
    username,
  });
}

export async function listUsers() {
  const db = await getDatabase();
  const rows = await all<UserRow>(
    db,
    `SELECT *
      FROM users
      ORDER BY
        CASE role
          WHEN 'sudo' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'dispatcher' THEN 2
          ELSE 3
        END,
        username ASC`,
  );

  return rows.map(mapUser);
}

export async function getUserById(id: string) {
  const db = await getDatabase();
  const row = await get<UserRow>(db, "SELECT * FROM users WHERE id = ?", [id]);
  return row ? mapUser(row) : null;
}

export async function authenticateUser(identifier: string, password: string) {
  const db = await getDatabase();

  const row = await get<UserRow>(
    db,
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [cleanUsername(identifier), cleanText(identifier, 200).toLowerCase()],
  );

  return row && verifyPassword(password, row) ? mapUser(row) : null;
}

export async function createUser(
  input: UserAccountInput,
): Promise<GoResult<UserAccount, { code: string; message: string }>> {
  const [normalized, error] = normalizeInput(input, true);
  if (error !== null) return fail(error);

  const password = hashPassword(normalized.password);
  const now = new Date().toISOString();
  const id = `usr-${randomBytes(16).toString("base64url")}`;

  await withDatabaseWriteTransaction(async (db) => {
    await run(
      db,
      `INSERT INTO users (
        id,
        username,
        password_hash,
        password_salt,
        password_iterations,
        name,
        email,
        department,
        role,
        phone,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalized.username,
        password.passwordHash,
        password.passwordSalt,
        password.passwordIterations,
        normalized.name,
        normalized.email,
        normalized.department,
        normalized.role,
        normalized.phone,
        now,
        now,
      ],
    );
  });

  return ok((await getUserById(id)) as UserAccount);
}

export async function updateUser(
  id: string,
  input: UserAccountInput,
): Promise<GoResult<UserAccount | null, { code: string; message: string }>> {
  const current = await getUserById(id);
  if (!current) return ok(null);

  const [normalized, error] = normalizeInput(
    {
      department: input.department ?? current.department,
      email: input.email ?? current.email,
      name: input.name ?? current.name,
      password: input.password,
      phone: input.phone ?? current.phone,
      role: input.role ?? current.role,
      username: input.username ?? current.username,
    },
    false,
  );
  if (error !== null) return fail(error);

  const password = normalized.password
    ? hashPassword(normalized.password)
    : null;
  const now = new Date().toISOString();

  await withDatabaseWriteTransaction(async (db) => {
    if (password) {
      await run(
        db,
        `UPDATE users
          SET username = ?,
              password_hash = ?,
              password_salt = ?,
              password_iterations = ?,
              name = ?,
              email = ?,
              department = ?,
              role = ?,
              phone = ?,
              updated_at = ?
          WHERE id = ?`,
        [
          normalized.username,
          password.passwordHash,
          password.passwordSalt,
          password.passwordIterations,
          normalized.name,
          normalized.email,
          normalized.department,
          normalized.role,
          normalized.phone,
          now,
          id,
        ],
      );
      return;
    }

    await run(
      db,
      `UPDATE users
        SET username = ?,
            name = ?,
            email = ?,
            department = ?,
            role = ?,
            phone = ?,
            updated_at = ?
        WHERE id = ?`,
      [
        normalized.username,
        normalized.name,
        normalized.email,
        normalized.department,
        normalized.role,
        normalized.phone,
        now,
        id,
      ],
    );
  });

  return ok(await getUserById(id));
}

export async function deleteUser(id: string) {
  const current = await getUserById(id);
  if (!current) return false;

  await withDatabaseWriteTransaction(async (db) => {
    await run(db, "DELETE FROM users WHERE id = ?", [id]);
  });

  return true;
}

export async function ensureSetupUsers(input: {
  admin: { email: string; name: string; password: string };
  sudo: { email: string; name: string; password: string };
}) {
  const existing = await listUsers();
  const usernames = new Set(existing.map((user) => user.username));

  if (!usernames.has("sudo")) {
    const [, error] = await createUser({
      department: "Command",
      email: input.sudo.email,
      name: input.sudo.name,
      password: input.sudo.password,
      phone: "",
      role: "sudo",
      username: "sudo",
    });
    if (error !== null) throw new Error(error.message);
  }

  if (!usernames.has("admin")) {
    const [, error] = await createUser({
      department: "Operations",
      email: input.admin.email,
      name: input.admin.name,
      password: input.admin.password,
      phone: "",
      role: "admin",
      username: "admin",
    });
    if (error !== null) throw new Error(error.message);
  }
}
