import Database from "better-sqlite3";
import type { DatabaseClient, DatabaseRunResult } from "@/lib/database/types";

function sqliteClient(
  database: Database.Database,
  options: { closeable: boolean },
): DatabaseClient {
  return {
    dialect: "sqlite",
    engine: "sqlite",
    async all<T>(sql: string, params: readonly unknown[] = []) {
      return database.prepare(sql).all(...params) as T[];
    },
    async close() {
      if (options.closeable) {
        database.close();
      }
    },
    async get<T>(sql: string, params: readonly unknown[] = []) {
      return database.prepare(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: readonly unknown[] = []) {
      if (params.length === 0 && sql.includes(";")) {
        database.exec(sql);
        return { changes: 0, lastInsertId: null };
      }

      const result = database.prepare(sql).run(...params);
      return {
        changes: result.changes,
        lastInsertId:
          typeof result.lastInsertRowid === "bigint"
            ? Number(result.lastInsertRowid)
            : result.lastInsertRowid,
      } satisfies DatabaseRunResult;
    },
    async transaction<T>(operation: (db: DatabaseClient) => Promise<T>) {
      database.exec("BEGIN IMMEDIATE");

      try {
        const result = await operation(
          sqliteClient(database, { closeable: false }),
        );
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

export function openSqliteClient(
  databasePath: string,
  options: { readonly?: boolean } = {},
) {
  const database = new Database(databasePath, {
    fileMustExist: Boolean(options.readonly),
    readonly: Boolean(options.readonly),
    timeout: 5_000,
  });
  database.pragma("busy_timeout = 5000");
  return sqliteClient(database, { closeable: true });
}
