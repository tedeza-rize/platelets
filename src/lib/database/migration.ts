import {
  type DatabaseConfig,
  getDatabaseConfig,
  normalizeDatabaseConfig,
  openDatabaseClient,
  saveDatabaseConfig,
} from "@/lib/database/config";
import {
  DATABASE_TABLES,
  initializeDatabaseSchema,
} from "@/lib/database/schema";
import { quoteIdentifier } from "@/lib/database/sql";
import type { DatabaseClient } from "@/lib/database/types";
import { closeDatabase, getDatabase } from "@/lib/points-db";

const COPY_BATCH_SIZE = 200;
const POSTGRESQL_SEQUENCE_TABLES = [
  "api_logs",
  "assembly_protests",
  "hazard_events",
  "points",
] as const;

export type DatabaseMigrationResult = {
  sourceEngine: DatabaseConfig["engine"];
  tableCounts: Record<string, number>;
  targetEngine: DatabaseConfig["engine"];
  totalRows: number;
};

function sameDatabaseConfig(left: DatabaseConfig, right: DatabaseConfig) {
  return (
    left.engine === right.engine &&
    left.connectionString === right.connectionString
  );
}

async function listTableColumns(db: DatabaseClient, table: string) {
  if (db.dialect === "sqlite") {
    return (
      await db.all<{ name: string }>(
        `PRAGMA table_info(${quoteIdentifier(table, db.dialect)})`,
      )
    ).map((column) => column.name);
  }

  const rows = await db.all<{ column_name: string }>(
    db.dialect === "postgresql"
      ? `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = ?
         ORDER BY ordinal_position`
      : `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?
         ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((column) => column.column_name);
}

async function insertRows(
  db: DatabaseClient,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) {
    return;
  }

  const quotedColumns = columns
    .map((column) => quoteIdentifier(column, db.dialect))
    .join(", ");
  const rowPlaceholders = `(${columns.map(() => "?").join(", ")})`;
  const placeholders = rows.map(() => rowPlaceholders).join(", ");
  const values = rows.flatMap((row) => columns.map((column) => row[column]));

  await db.run(
    `INSERT INTO ${quoteIdentifier(table, db.dialect)} (${quotedColumns})
     VALUES ${placeholders}`,
    values,
  );
}

async function resetPostgresqlSequences(db: DatabaseClient) {
  if (db.dialect !== "postgresql") {
    return;
  }

  for (const table of POSTGRESQL_SEQUENCE_TABLES) {
    const quotedTable = quoteIdentifier(table, db.dialect);
    await db.run(
      `SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        COALESCE(MAX(id), 1),
        MAX(id) IS NOT NULL
      ) FROM ${quotedTable}`,
    );
  }
}

async function prepareSourceSnapshot(db: DatabaseClient) {
  if (db.dialect === "postgresql") {
    await db.run("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return;
  }

  if (db.dialect === "mysql") {
    await db.run("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  }
}

export async function copyDatabaseContents(
  source: DatabaseClient,
  target: DatabaseClient,
) {
  const tableCounts: Record<string, number> = {};

  await source.transaction(async (sourceTransaction) => {
    await prepareSourceSnapshot(sourceTransaction);

    return target.transaction(async (targetTransaction) => {
      for (const table of [...DATABASE_TABLES].reverse()) {
        await targetTransaction.run(
          `DELETE FROM ${quoteIdentifier(table, targetTransaction.dialect)}`,
        );
      }

      for (const table of DATABASE_TABLES) {
        const columns = await listTableColumns(sourceTransaction, table);

        if (columns.length === 0) {
          tableCounts[table] = 0;
          continue;
        }

        const selectColumns = columns
          .map((column) => quoteIdentifier(column, sourceTransaction.dialect))
          .join(", ");
        let offset = 0;

        while (true) {
          const rows = await sourceTransaction.all<Record<string, unknown>>(
            `SELECT ${selectColumns}
             FROM ${quoteIdentifier(table, sourceTransaction.dialect)}
             LIMIT ? OFFSET ?`,
            [COPY_BATCH_SIZE, offset],
          );

          if (rows.length === 0) {
            break;
          }

          await insertRows(targetTransaction, table, columns, rows);
          offset += rows.length;
        }

        tableCounts[table] = offset;
      }

      await resetPostgresqlSequences(targetTransaction);
    });
  });

  return tableCounts;
}

export async function migrateDatabase(
  targetInput: DatabaseConfig,
): Promise<DatabaseMigrationResult> {
  const sourceConfig = getDatabaseConfig();
  const targetConfig = normalizeDatabaseConfig(targetInput);

  if (sameDatabaseConfig(sourceConfig, targetConfig)) {
    throw new Error("Source and target databases must be different.");
  }

  const source = await getDatabase();
  const target = openDatabaseClient(targetConfig);

  try {
    await initializeDatabaseSchema(target);
    const tableCounts = await copyDatabaseContents(source, target);
    const totalRows = Object.values(tableCounts).reduce(
      (total, count) => total + count,
      0,
    );

    saveDatabaseConfig(targetConfig);
    await closeDatabase();

    return {
      sourceEngine: sourceConfig.engine,
      tableCounts,
      targetEngine: targetConfig.engine,
      totalRows,
    };
  } finally {
    await target.close().catch(() => undefined);
  }
}
