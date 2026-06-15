import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { databaseSql } from "@/lib/database/sql";
import type { DatabaseClient, DatabaseEngine } from "@/lib/database/types";
import { databaseParams, normalizeDatabaseRow } from "@/lib/database/values";

type MysqlQueryable = Pool | PoolConnection;
type MysqlParam =
  | bigint
  | boolean
  | Buffer
  | Date
  | null
  | number
  | string
  | Uint8Array;

function mysqlParams(params: readonly unknown[]) {
  return databaseParams(params).map((value) =>
    value === undefined ? null : (value as MysqlParam),
  );
}

function mysqlClient(
  queryable: MysqlQueryable,
  engine: Extract<DatabaseEngine, "mariadb" | "mysql">,
  options: { close?: () => Promise<void>; kind: "connection" | "pool" },
): DatabaseClient {
  return {
    dialect: "mysql",
    engine,
    async all<T>(sql: string, params: readonly unknown[] = []) {
      const [rows] = await queryable.execute<RowDataPacket[]>(
        databaseSql(sql, "mysql"),
        mysqlParams(params),
      );
      return rows.map(normalizeDatabaseRow) as T[];
    },
    async close() {
      await options.close?.();
    },
    async get<T>(sql: string, params: readonly unknown[] = []) {
      const rows = await this.all<T>(sql, params);
      return rows[0];
    },
    async run(sql: string, params: readonly unknown[] = []) {
      const [result] = await queryable.execute<ResultSetHeader>(
        databaseSql(sql, "mysql"),
        mysqlParams(params),
      );
      return {
        changes: result.affectedRows,
        lastInsertId: result.insertId || null,
      };
    },
    async transaction<T>(operation: (db: DatabaseClient) => Promise<T>) {
      if (options.kind === "connection") {
        const connection = queryable as PoolConnection;
        await connection.beginTransaction();

        try {
          const result = await operation(
            mysqlClient(connection, engine, { kind: "connection" }),
          );
          await connection.commit();
          return result;
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }

      const connection = await (queryable as Pool).getConnection();

      try {
        await connection.beginTransaction();
        const result = await operation(
          mysqlClient(connection, engine, { kind: "connection" }),
        );
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export function openMysqlClient(
  connectionString: string,
  engine: Extract<DatabaseEngine, "mariadb" | "mysql">,
) {
  const pool = mysql.createPool({
    connectionLimit: 10,
    enableKeepAlive: true,
    timezone: "Z",
    uri: connectionString,
  });
  return mysqlClient(pool, engine, { close: () => pool.end(), kind: "pool" });
}
