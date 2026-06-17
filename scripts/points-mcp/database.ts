import Database from "better-sqlite3";
import { databasePath } from "./runtime.ts";
import type { SqliteDatabase } from "./types.ts";

export async function getDatabase(): Promise<SqliteDatabase> {
  return new Database(databasePath, {
    fileMustExist: true,
    readonly: true,
    timeout: 5_000,
  });
}

export async function all<TRow>(
  db: SqliteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<TRow[]> {
  return db.prepare(sql).all(...params) as TRow[];
}

export async function closeDatabase(db: SqliteDatabase): Promise<void> {
  db.close();
}

export async function withDatabase<TResult>(
  callback: (db: SqliteDatabase) => Promise<TResult>,
) {
  const db = await getDatabase();

  try {
    return await callback(db);
  } finally {
    await closeDatabase(db);
  }
}
