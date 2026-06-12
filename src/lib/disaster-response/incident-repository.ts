import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { INITIAL_INCIDENTS } from "@/lib/disaster-response/mock-data";
import type {
  Incident,
  IncidentEvent,
  IncidentEventType,
  IncidentStatus,
  IncidentType,
  RiskLevel,
} from "@/lib/disaster-response/types";

type SqliteDatabase = sqlite3.Database;

type IncidentRow = {
  address: string;
  created_at: string;
  description: string;
  id: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  risk_level: string;
  status: string;
  title: string;
  type: string;
  updated_at: string;
};

type IncidentEventRow = {
  created_at: string;
  from_status: string | null;
  id: string;
  incident_id: string;
  message: string;
  to_status: string | null;
  type: string;
};

type MaxIncidentIdRow = {
  max_id: number | null;
};

export type IncidentRepository = {
  createIncident(incident: Omit<Incident, "id">): Promise<Incident>;
  deleteIncident(id: string): Promise<boolean>;
  getIncident(id: string): Promise<Incident | null>;
  listIncidentEvents(id: string): Promise<IncidentEvent[]>;
  listIncidents(): Promise<Incident[]>;
  updateIncident(
    id: string,
    incident: Omit<Incident, "createdAt" | "id" | "status">,
  ): Promise<Incident | null>;
  updateIncidentStatus(
    id: string,
    status: IncidentStatus,
  ): Promise<Incident | null>;
};

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "points.sqlite");

let databasePromise: Promise<SqliteDatabase> | null = null;
let writeTransactionQueue: Promise<void> = Promise.resolve();

function run(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function all<T>(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (error, rows: T[]) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function get<T>(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (error, row: T | undefined) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

async function withWriteTransaction<T>(
  operation: (db: SqliteDatabase) => Promise<T>,
) {
  const previousTransaction = writeTransactionQueue;
  let releaseTransaction = () => {};
  writeTransactionQueue = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });

  await previousTransaction;

  const db = await getDatabase();
  let transactionStarted = false;

  try {
    await run(db, "BEGIN IMMEDIATE");
    transactionStarted = true;
    const result = await operation(db);
    await run(db, "COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      await run(db, "ROLLBACK").catch(() => undefined);
    }

    throw error;
  } finally {
    releaseTransaction();
  }
}

function asIncidentType(value: string): IncidentType {
  return value === "rescue" ||
    value === "medical" ||
    value === "traffic" ||
    value === "fire"
    ? value
    : "fire";
}

function asRiskLevel(value: string): RiskLevel {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function asIncidentStatus(value: string): IncidentStatus {
  return value === "dispatched" || value === "closed" || value === "reported"
    ? value
    : "reported";
}

function asIncidentEventType(value: string): IncidentEventType {
  return value === "created" ||
    value === "updated" ||
    value === "status" ||
    value === "deleted"
    ? value
    : "updated";
}

function mapIncidentRow(row: IncidentRow): Incident {
  return {
    address: row.address,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    occurredAt: row.occurred_at,
    riskLevel: asRiskLevel(row.risk_level),
    status: asIncidentStatus(row.status),
    title: row.title,
    type: asIncidentType(row.type),
  };
}

function mapIncidentEventRow(row: IncidentEventRow): IncidentEvent {
  return {
    createdAt: row.created_at,
    fromStatus: row.from_status ? asIncidentStatus(row.from_status) : null,
    id: row.id,
    incidentId: row.incident_id,
    message: row.message,
    toStatus: row.to_status ? asIncidentStatus(row.to_status) : null,
    type: asIncidentEventType(row.type),
  };
}

async function insertIncident(db: SqliteDatabase, incident: Incident) {
  await run(
    db,
    `INSERT INTO disaster_incidents (
      id,
      type,
      title,
      description,
      address,
      latitude,
      longitude,
      risk_level,
      status,
      occurred_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      incident.id,
      incident.type,
      incident.title,
      incident.description,
      incident.address,
      incident.latitude,
      incident.longitude,
      incident.riskLevel,
      incident.status,
      incident.occurredAt,
      incident.createdAt,
      incident.createdAt,
    ],
  );
}

async function insertIncidentEvent(
  db: SqliteDatabase,
  event: Omit<IncidentEvent, "id">,
) {
  await run(
    db,
    `INSERT INTO disaster_incident_events (
      id,
      incident_id,
      type,
      message,
      from_status,
      to_status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `evt-${randomUUID()}`,
      event.incidentId,
      event.type,
      event.message,
      event.fromStatus,
      event.toStatus,
      event.createdAt,
    ],
  );
}

async function seedInitialIncidents(db: SqliteDatabase) {
  const row = await get<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM disaster_incidents",
  );

  if ((row?.count ?? 0) > 0) {
    return;
  }

  for (const incident of INITIAL_INCIDENTS) {
    await insertIncident(db, incident);
  }
}

async function backfillInitialIncidentEvents(db: SqliteDatabase) {
  const row = await get<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM disaster_incident_events",
  );

  if ((row?.count ?? 0) > 0) {
    return;
  }

  const incidents = await all<IncidentRow>(
    db,
    "SELECT * FROM disaster_incidents ORDER BY created_at ASC",
  );

  for (const incident of incidents.map(mapIncidentRow)) {
    await insertIncidentEvent(db, {
      createdAt: incident.createdAt,
      fromStatus: null,
      incidentId: incident.id,
      message: "초기 사고 데이터 등록",
      toStatus: incident.status,
      type: "created",
    });
  }
}

async function initializeDatabase(db: SqliteDatabase) {
  await run(db, "PRAGMA journal_mode = WAL");
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS disaster_incidents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS disaster_incident_events (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      created_at TEXT NOT NULL
    )`,
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS disaster_incidents_occurred_idx ON disaster_incidents(occurred_at DESC)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS disaster_incidents_coordinates_idx ON disaster_incidents(latitude, longitude)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS disaster_incidents_type_risk_idx ON disaster_incidents(type, risk_level)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS disaster_incident_events_incident_idx ON disaster_incident_events(incident_id, created_at DESC)",
  );
  await seedInitialIncidents(db);
  await backfillInitialIncidentEvents(db);
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<SqliteDatabase>((resolve, reject) => {
      fs.mkdirSync(dataDirectory, { recursive: true });
      const db = new sqlite3.Database(databasePath, (error) => {
        if (error) {
          reject(error);
          return;
        }

        initializeDatabase(db).then(() => resolve(db), reject);
      });
    });
  }

  return databasePromise;
}

export class SqliteIncidentRepository implements IncidentRepository {
  async listIncidents() {
    const db = await getDatabase();
    const rows = await all<IncidentRow>(
      db,
      `SELECT *
        FROM disaster_incidents
        ORDER BY occurred_at DESC, created_at DESC`,
    );

    return rows.map(mapIncidentRow);
  }

  async getIncident(id: string) {
    const db = await getDatabase();
    const row = await get<IncidentRow>(
      db,
      "SELECT * FROM disaster_incidents WHERE id = ?",
      [id],
    );

    return row ? mapIncidentRow(row) : null;
  }

  async listIncidentEvents(id: string) {
    const db = await getDatabase();
    const rows = await all<IncidentEventRow>(
      db,
      `SELECT *
        FROM disaster_incident_events
        WHERE incident_id = ?
        ORDER BY created_at DESC`,
      [id],
    );

    return rows.map(mapIncidentEventRow);
  }

  async createIncident(input: Omit<Incident, "id">) {
    return withWriteTransaction(async (db) => {
      const row = await get<MaxIncidentIdRow>(
        db,
        `SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) AS max_id
          FROM (
            SELECT id
              FROM disaster_incidents
              WHERE id GLOB 'inc-[0-9]*'
            UNION ALL
            SELECT incident_id AS id
              FROM disaster_incident_events
              WHERE incident_id GLOB 'inc-[0-9]*'
          )`,
      );
      const id = `inc-${String((row?.max_id ?? 0) + 1).padStart(3, "0")}`;
      const incident: Incident = { ...input, id };

      await insertIncident(db, incident);
      await insertIncidentEvent(db, {
        createdAt: incident.createdAt,
        fromStatus: null,
        incidentId: incident.id,
        message: "사고 접수",
        toStatus: incident.status,
        type: "created",
      });

      return incident;
    });
  }

  async updateIncident(
    id: string,
    input: Omit<Incident, "createdAt" | "id" | "status">,
  ) {
    const now = new Date().toISOString();

    return withWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ?",
        [id],
      );

      if (!current) {
        return null;
      }

      await run(
        db,
        `UPDATE disaster_incidents
          SET type = ?,
              title = ?,
              description = ?,
              address = ?,
              latitude = ?,
              longitude = ?,
              risk_level = ?,
              occurred_at = ?,
              updated_at = ?
          WHERE id = ?`,
        [
          input.type,
          input.title,
          input.description,
          input.address,
          input.latitude,
          input.longitude,
          input.riskLevel,
          input.occurredAt,
          now,
          id,
        ],
      );
      await insertIncidentEvent(db, {
        createdAt: now,
        fromStatus: null,
        incidentId: id,
        message: "사고 정보 수정",
        toStatus: null,
        type: "updated",
      });

      const row = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ?",
        [id],
      );

      return row ? mapIncidentRow(row) : null;
    });
  }

  async updateIncidentStatus(id: string, status: IncidentStatus) {
    const now = new Date().toISOString();

    return withWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ?",
        [id],
      );

      if (!current) {
        return null;
      }

      await run(
        db,
        `UPDATE disaster_incidents
          SET status = ?, updated_at = ?
          WHERE id = ?`,
        [status, now, id],
      );
      await insertIncidentEvent(db, {
        createdAt: now,
        fromStatus: asIncidentStatus(current.status),
        incidentId: id,
        message: "사고 상태 변경",
        toStatus: status,
        type: "status",
      });

      const row = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ?",
        [id],
      );

      return row ? mapIncidentRow(row) : null;
    });
  }

  async deleteIncident(id: string) {
    const now = new Date().toISOString();

    return withWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ?",
        [id],
      );

      if (!current) {
        return false;
      }

      await run(db, "DELETE FROM disaster_incidents WHERE id = ?", [id]);
      await insertIncidentEvent(db, {
        createdAt: now,
        fromStatus: asIncidentStatus(current.status),
        incidentId: id,
        message: `사고 삭제: ${current.title}`,
        toStatus: null,
        type: "deleted",
      });

      return true;
    });
  }
}

export const incidentRepository = new SqliteIncidentRepository();
