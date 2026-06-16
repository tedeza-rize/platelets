import { randomUUID } from "node:crypto";
import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import type { DatabaseClient } from "@/lib/database/types";
import {
  asIncidentStatus,
  type IncidentEventRow,
  type IncidentRow,
  mapIncidentEventRow,
  mapIncidentRow,
} from "@/lib/disaster-response/incident-row-mappers";
import { INITIAL_INCIDENTS } from "@/lib/disaster-response/mock-data";
import type {
  Incident,
  IncidentActor,
  IncidentEvent,
  IncidentStatus,
} from "@/lib/disaster-response/types";
import { withDatabaseWriteTransaction } from "@/lib/points-db";

type MaxIncidentIdRow = {
  max_id: number | null;
};

export type IncidentRepository = {
  createIncident: (
    incident: Omit<Incident, "id">,
    actor?: IncidentActor | null,
  ) => Promise<Incident>;
  deleteIncident: (
    id: string,
    actor?: IncidentActor | null,
  ) => Promise<boolean>;
  getIncident: (id: string) => Promise<Incident | null>;
  listIncidentEvents: (id: string) => Promise<IncidentEvent[]>;
  listIncidents: () => Promise<Incident[]>;
  updateIncident: (
    id: string,
    incident: Omit<Incident, "createdAt" | "id" | "status">,
    actor?: IncidentActor | null,
  ) => Promise<Incident | null>;
  updateIncidentStatus: (
    id: string,
    status: IncidentStatus,
    actor?: IncidentActor | null,
  ) => Promise<Incident | null>;
};

let databasePromise: Promise<DatabaseClient> | null = null;

async function insertIncident(db: DatabaseClient, incident: Incident) {
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
  db: DatabaseClient,
  event: Omit<IncidentEvent, "actorId" | "actorName" | "actorRole" | "id"> & {
    actor?: IncidentActor | null;
  },
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
      actor_id,
      actor_name,
      actor_role,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `evt-${randomUUID()}`,
      event.incidentId,
      event.type,
      event.message,
      event.fromStatus,
      event.toStatus,
      event.actor?.id ?? null,
      event.actor?.name ?? null,
      event.actor?.role ?? null,
      event.createdAt,
    ],
  );
}

async function seedInitialIncidents(db: DatabaseClient) {
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

async function backfillInitialIncidentEvents(db: DatabaseClient) {
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

async function initializeDatabase(db: DatabaseClient) {
  await seedInitialIncidents(db);
  await backfillInitialIncidentEvents(db);
}

async function getIncidentDatabase() {
  if (!databasePromise) {
    databasePromise = withDatabaseWriteTransaction(async (db) => {
      await initializeDatabase(db);
      return db;
    });
  }

  return databasePromise;
}

async function withIncidentWriteTransaction<T>(
  operation: (db: DatabaseClient) => Promise<T>,
) {
  await getIncidentDatabase();
  return withDatabaseWriteTransaction(operation);
}

export class SqliteIncidentRepository implements IncidentRepository {
  async listIncidents() {
    const db = await getIncidentDatabase();
    const rows = await all<IncidentRow>(
      db,
      `SELECT *
        FROM disaster_incidents
        WHERE deleted_at IS NULL
        ORDER BY occurred_at DESC, created_at DESC`,
    );

    return rows.map(mapIncidentRow);
  }

  async getIncident(id: string) {
    const db = await getIncidentDatabase();
    const row = await get<IncidentRow>(
      db,
      "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
      [id],
    );

    return row ? mapIncidentRow(row) : null;
  }

  async listIncidentEvents(id: string) {
    const db = await getIncidentDatabase();
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

  async createIncident(
    input: Omit<Incident, "id">,
    actor?: IncidentActor | null,
  ) {
    return withIncidentWriteTransaction(async (db) => {
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
        actor,
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
    actor?: IncidentActor | null,
  ) {
    const now = new Date().toISOString();

    return withIncidentWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
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
        actor,
        createdAt: now,
        fromStatus: null,
        incidentId: id,
        message: "사고 정보 수정",
        toStatus: null,
        type: "updated",
      });

      const row = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
        [id],
      );

      return row ? mapIncidentRow(row) : null;
    });
  }

  async updateIncidentStatus(
    id: string,
    status: IncidentStatus,
    actor?: IncidentActor | null,
  ) {
    const now = new Date().toISOString();

    return withIncidentWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
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
        actor,
        createdAt: now,
        fromStatus: asIncidentStatus(current.status),
        incidentId: id,
        message: "사고 상태 변경",
        toStatus: status,
        type: "status",
      });

      const row = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
        [id],
      );

      return row ? mapIncidentRow(row) : null;
    });
  }

  async deleteIncident(id: string, actor?: IncidentActor | null) {
    const now = new Date().toISOString();

    return withIncidentWriteTransaction(async (db) => {
      const current = await get<IncidentRow>(
        db,
        "SELECT * FROM disaster_incidents WHERE id = ? AND deleted_at IS NULL",
        [id],
      );

      if (!current) {
        return false;
      }

      await insertIncidentEvent(db, {
        actor,
        createdAt: now,
        fromStatus: asIncidentStatus(current.status),
        incidentId: id,
        message: `사고 삭제: ${current.title}`,
        toStatus: null,
        type: "deleted",
      });
      await run(
        db,
        `UPDATE disaster_incidents
          SET deleted_at = ?, updated_at = ?
          WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );

      return true;
    });
  }
}

export const incidentRepository = new SqliteIncidentRepository();
