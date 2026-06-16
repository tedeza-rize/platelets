import {
  allDatabase as all,
  getDatabaseRow as get,
} from "@/lib/database/query";
import { getDatabase } from "@/lib/points-db-modules/connection";

export type IncidentChange = {
  eventId?: string;
  incidentId: string;
  mutation: "created" | "deleted" | "updated";
  occurredAt: string;
  version: number;
};

type IncidentChangeInput = Pick<IncidentChange, "incidentId" | "mutation">;
type IncidentChangeListener = (change: IncidentChange) => void;
export type IncidentChangeCursor = {
  createdAt: string;
  eventId: string;
};

type IncidentChangeRow = {
  created_at: string;
  id: string;
  incident_id: string;
  type: string;
};

type IncidentChangeHub = {
  listeners: Set<IncidentChangeListener>;
  version: number;
};

const globalScope = globalThis as typeof globalThis & {
  __plateletsIncidentChangeHub?: IncidentChangeHub;
};

function getHub() {
  globalScope.__plateletsIncidentChangeHub ??= {
    listeners: new Set(),
    version: 0,
  };

  return globalScope.__plateletsIncidentChangeHub;
}

export function getIncidentChangeVersion() {
  return getHub().version;
}

export function getIncidentChangeSubscriberCount() {
  return getHub().listeners.size;
}

export function publishIncidentChange(input: IncidentChangeInput) {
  const hub = getHub();
  const change: IncidentChange = {
    ...input,
    occurredAt: new Date().toISOString(),
    version: hub.version + 1,
  };
  hub.version = change.version;

  for (const listener of hub.listeners) {
    try {
      listener(change);
    } catch {
      // One failing listener must not prevent delivery to remaining clients.
    }
  }

  return change;
}

export function subscribeToIncidentChanges(listener: IncidentChangeListener) {
  const hub = getHub();
  hub.listeners.add(listener);

  return () => {
    hub.listeners.delete(listener);
  };
}

function mutationFromEventType(type: string): IncidentChange["mutation"] {
  if (type === "created" || type === "deleted") {
    return type;
  }

  return "updated";
}

function mapIncidentChangeRow(row: IncidentChangeRow): IncidentChange {
  return {
    eventId: row.id,
    incidentId: row.incident_id,
    mutation: mutationFromEventType(row.type),
    occurredAt: row.created_at,
    version: 0,
  };
}

export async function getCurrentIncidentChangeCursor(): Promise<IncidentChangeCursor | null> {
  const db = await getDatabase();
  const row = await get<IncidentChangeRow>(
    db,
    `SELECT id, incident_id, type, created_at
      FROM disaster_incident_events
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  );

  return row ? { createdAt: row.created_at, eventId: row.id } : null;
}

export async function listIncidentChangesAfterCursor(
  cursor: IncidentChangeCursor | null,
  limit = 50,
) {
  if (cursor === null) {
    return {
      changes: [],
      cursor: await getCurrentIncidentChangeCursor(),
    };
  }

  const db = await getDatabase();
  const rows = await all<IncidentChangeRow>(
    db,
    `SELECT id, incident_id, type, created_at
      FROM disaster_incident_events
      WHERE created_at > ?
         OR (created_at = ? AND id > ?)
      ORDER BY created_at ASC, id ASC
      LIMIT ?`,
    [cursor.createdAt, cursor.createdAt, cursor.eventId, limit],
  );
  const changes = rows.map(mapIncidentChangeRow);
  const last = rows.at(-1);

  return {
    changes,
    cursor: last ? { createdAt: last.created_at, eventId: last.id } : cursor,
  };
}
