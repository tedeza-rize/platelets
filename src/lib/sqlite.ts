import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function openSqliteDatabase(
  databasePath: string,
  options: { readonly?: boolean } = {},
) {
  const db = new Database(databasePath, {
    fileMustExist: Boolean(options.readonly),
    readonly: Boolean(options.readonly),
    timeout: 5_000,
  });
  db.pragma("busy_timeout = 5000");
  return db;
}

export async function runSqlite(
  db: SqliteDatabase,
  sql: string,
  params: readonly unknown[] = [],
) {
  if (params.length === 0) {
    db.exec(sql);
    return;
  }

  db.prepare(sql).run(...params);
}

export async function allSqlite<T>(
  db: SqliteDatabase,
  sql: string,
  params: readonly unknown[] = [],
) {
  return db.prepare(sql).all(...params) as T[];
}

export async function getSqlite<T>(
  db: SqliteDatabase,
  sql: string,
  params: readonly unknown[] = [],
) {
  return db.prepare(sql).get(...params) as T | undefined;
}

export async function closeSqliteDatabase(db: SqliteDatabase) {
  db.close();
}
