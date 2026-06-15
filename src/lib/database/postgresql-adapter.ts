import { Pool, type PoolClient, type QueryResult } from "pg";
import { databaseSql } from "@/lib/database/sql";
import type { DatabaseClient } from "@/lib/database/types";
import { databaseParams, normalizeDatabaseRow } from "@/lib/database/values";

type PostgreSqlQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

function postgresqlClient(
  queryable: PostgreSqlQueryable,
  options: { close?: () => Promise<void>; engine?: "postgresql" },
): DatabaseClient {
  async function query<T>(sql: string, params: readonly unknown[] = []) {
    return queryable.query(
      databaseSql(sql, "postgresql"),
      databaseParams(params),
    ) as Promise<QueryResult<T & Record<string, unknown>>>;
  }

  return {
    dialect: "postgresql",
    engine: options.engine ?? "postgresql",
    async all<T>(sql: string, params: readonly unknown[] = []) {
      return (await query<T>(sql, params)).rows.map(
        normalizeDatabaseRow,
      ) as T[];
    },
    async close() {
      await options.close?.();
    },
    async get<T>(sql: string, params: readonly unknown[] = []) {
      const row = (await query<T>(sql, params)).rows[0] as T | undefined;
      return row ? normalizeDatabaseRow(row) : undefined;
    },
    async run(sql: string, params: readonly unknown[] = []) {
      const result = await query(sql, params);
      return { changes: result.rowCount ?? 0, lastInsertId: null };
    },
    async transaction<T>(operation: (db: DatabaseClient) => Promise<T>) {
      if (!(queryable instanceof Pool)) {
        await queryable.query("BEGIN");

        try {
          const result = await operation(
            postgresqlClient(queryable, { engine: "postgresql" }),
          );
          await queryable.query("COMMIT");
          return result;
        } catch (error) {
          await queryable.query("ROLLBACK");
          throw error;
        }
      }

      const connection = await queryable.connect();

      try {
        await connection.query("BEGIN");
        const result = await operation(
          postgresqlClient(connection, { engine: "postgresql" }),
        );
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export function openPostgresqlClient(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  return postgresqlClient(pool, { close: () => pool.end() });
}
