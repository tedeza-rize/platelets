import { quoteIdentifier } from "@/lib/database/sql";
import type { DatabaseClient } from "@/lib/database/types";

const INCIDENT_EVENT_FK_NAME = "disaster_incident_events_incident_fk";
const INCIDENT_EVENT_COLUMNS = [
  "id",
  "incident_id",
  "type",
  "message",
  "from_status",
  "to_status",
  "actor_id",
  "actor_name",
  "actor_role",
  "created_at",
] as const;

function types(db: DatabaseClient) {
  return {
    key: db.dialect === "mysql" ? "VARCHAR(191)" : "TEXT",
    text: db.dialect === "mysql" ? "LONGTEXT" : "TEXT",
    timestamp: db.dialect === "postgresql" ? "TIMESTAMPTZ" : "DATETIME(3)",
  };
}

export function incidentEventTableStatement(
  db: DatabaseClient,
  options: { ifNotExists?: boolean; table?: string } = {},
) {
  const type = types(db);
  const clause = options.ifNotExists === false ? "" : "IF NOT EXISTS ";
  const table = quoteIdentifier(
    options.table ?? "disaster_incident_events",
    db.dialect,
  );

  if (db.dialect === "sqlite") {
    type.timestamp = "TEXT";
  }

  return `CREATE TABLE ${clause}${table} (
    id ${type.key} PRIMARY KEY,
    incident_id ${type.key} NOT NULL,
    type ${type.key} NOT NULL,
    message ${type.text} NOT NULL,
    from_status ${type.key},
    to_status ${type.key},
    actor_id ${type.key},
    actor_name ${type.text},
    actor_role ${type.key},
    created_at ${type.timestamp} NOT NULL,
    CONSTRAINT ${quoteIdentifier(INCIDENT_EVENT_FK_NAME, db.dialect)}
      FOREIGN KEY (incident_id)
      REFERENCES disaster_incidents(id)
      ON DELETE RESTRICT
  )`;
}

async function purgeOrphanIncidentEvents(db: DatabaseClient) {
  // Incidents are soft-deleted (deleted_at), so their rows survive and their
  // events keep a valid parent. True orphans only come from legacy hard-deletes
  // performed before this foreign key existed: they reference a parent incident
  // that is gone for good and can never be reattached. Purge them so the
  // ON DELETE RESTRICT foreign key can be added without bricking schema init.
  await db.run(
    `DELETE FROM disaster_incident_events
      WHERE incident_id NOT IN (SELECT id FROM disaster_incidents)`,
  );
}

async function hasIncidentEventForeignKey(db: DatabaseClient) {
  if (db.dialect === "sqlite") {
    const rows = await db.all<{ from: string; table: string; to: string }>(
      `PRAGMA foreign_key_list(${quoteIdentifier("disaster_incident_events", db.dialect)})`,
    );
    return rows.some(
      (row) =>
        row.from === "incident_id" &&
        row.table === "disaster_incidents" &&
        row.to === "id",
    );
  }

  return Boolean(
    await db.get(
      db.dialect === "postgresql"
        ? `SELECT constraint_name
             FROM information_schema.table_constraints
            WHERE table_schema = current_schema()
              AND table_name = ?
              AND constraint_name = ?
              AND constraint_type = 'FOREIGN KEY'`
        : `SELECT constraint_name
             FROM information_schema.table_constraints
            WHERE table_schema = DATABASE()
              AND table_name = ?
              AND constraint_name = ?
              AND constraint_type = 'FOREIGN KEY'`,
      ["disaster_incident_events", INCIDENT_EVENT_FK_NAME],
    ),
  );
}

async function rebuildSqliteIncidentEventsWithForeignKey(db: DatabaseClient) {
  const nextTable = "disaster_incident_events_next";
  const columns = INCIDENT_EVENT_COLUMNS.map((column) =>
    quoteIdentifier(column, db.dialect),
  ).join(", ");

  await db.run(
    `DROP TABLE IF EXISTS ${quoteIdentifier(nextTable, db.dialect)}`,
  );
  await db.run("PRAGMA foreign_keys = OFF");

  try {
    await db.run(
      incidentEventTableStatement(db, {
        ifNotExists: false,
        table: nextTable,
      }),
    );
    await db.run(
      `INSERT INTO ${quoteIdentifier(nextTable, db.dialect)} (${columns})
       SELECT ${columns}
         FROM ${quoteIdentifier("disaster_incident_events", db.dialect)}`,
    );
    await db.run(
      `DROP TABLE ${quoteIdentifier("disaster_incident_events", db.dialect)}`,
    );
    await db.run(
      `ALTER TABLE ${quoteIdentifier(nextTable, db.dialect)}
       RENAME TO ${quoteIdentifier("disaster_incident_events", db.dialect)}`,
    );
  } finally {
    await db.run("PRAGMA foreign_keys = ON");
  }
}

async function ensureIncidentEventForeignKey(db: DatabaseClient) {
  if (await hasIncidentEventForeignKey(db)) {
    return;
  }

  if (db.dialect === "sqlite") {
    await rebuildSqliteIncidentEventsWithForeignKey(db);
    return;
  }

  await db.run(
    `ALTER TABLE ${quoteIdentifier("disaster_incident_events", db.dialect)}
     ADD CONSTRAINT ${quoteIdentifier(INCIDENT_EVENT_FK_NAME, db.dialect)}
     FOREIGN KEY (${quoteIdentifier("incident_id", db.dialect)})
     REFERENCES ${quoteIdentifier("disaster_incidents", db.dialect)}(${quoteIdentifier("id", db.dialect)})
     ON DELETE RESTRICT`,
  );
}

export async function ensureIncidentEventIntegrity(db: DatabaseClient) {
  await purgeOrphanIncidentEvents(db);
  await ensureIncidentEventForeignKey(db);
}
