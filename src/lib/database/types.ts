export type DatabaseEngine = "mariadb" | "mysql" | "postgresql" | "sqlite";

export type DatabaseDialect = "mysql" | "postgresql" | "sqlite";

export type DatabaseRunResult = {
  changes: number;
  lastInsertId: number | null;
};

export type DatabaseClient = {
  all: <T>(sql: string, params?: readonly unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
  readonly dialect: DatabaseDialect;
  readonly engine: DatabaseEngine;
  get: <T>(sql: string, params?: readonly unknown[]) => Promise<T | undefined>;
  run: (sql: string, params?: readonly unknown[]) => Promise<DatabaseRunResult>;
  transaction: <T>(operation: (db: DatabaseClient) => Promise<T>) => Promise<T>;
};

export function databaseDialect(engine: DatabaseEngine): DatabaseDialect {
  return engine === "mariadb" ? "mysql" : engine;
}
