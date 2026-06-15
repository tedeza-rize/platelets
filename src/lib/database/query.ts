import type { DatabaseClient } from "@/lib/database/types";

export async function runDatabase(
  db: DatabaseClient,
  sql: string,
  params: readonly unknown[] = [],
) {
  return db.run(sql, params);
}

export async function allDatabase<T>(
  db: DatabaseClient,
  sql: string,
  params: readonly unknown[] = [],
) {
  return db.all<T>(sql, params);
}

export async function getDatabaseRow<T>(
  db: DatabaseClient,
  sql: string,
  params: readonly unknown[] = [],
) {
  return db.get<T>(sql, params);
}
