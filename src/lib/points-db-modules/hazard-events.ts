import { allDatabase as all, runDatabase as run } from "@/lib/database/query";
import {
  getDatabase,
  withDatabaseWriteTransaction,
} from "@/lib/points-db-modules/connection";
import type { HazardEvent, HazardEventInput } from "@/lib/points-db-types";

type HazardEventRow = {
  depth: string | null;
  description: string | null;
  event_id: string;
  event_type: HazardEvent["eventType"];
  fetched_at: string | null;
  id: number;
  image_url: string | null;
  intensity: string | null;
  issued_at: string | null;
  latitude: number | null;
  location: string;
  longitude: number | null;
  magnitude: string | null;
  occurred_at: string | null;
  raw_json: string;
  title: string;
};

function mapHazardEventRow(row: HazardEventRow): HazardEvent {
  return {
    depth: row.depth,
    description: row.description,
    eventId: row.event_id,
    eventType: row.event_type,
    fetchedAt: row.fetched_at,
    id: row.id,
    imageUrl: row.image_url,
    intensity: row.intensity,
    issuedAt: row.issued_at,
    latitude: row.latitude,
    location: row.location,
    longitude: row.longitude,
    magnitude: row.magnitude,
    occurredAt: row.occurred_at,
    raw: JSON.parse(row.raw_json) as Record<string, string>,
    title: row.title,
  };
}

export async function listHazardEvents(options: { limit?: number } = {}) {
  const db = await getDatabase();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 300);
  const rows = await all<HazardEventRow>(
    db,
    `SELECT *
      FROM hazard_events
      ORDER BY COALESCE(issued_at, occurred_at, fetched_at) DESC, id DESC
      LIMIT ?`,
    [limit],
  );

  return rows.map(mapHazardEventRow);
}

export async function upsertHazardEvents(params: {
  events: HazardEventInput[];
  fetchedAt: string;
}) {
  await withDatabaseWriteTransaction(async (db) => {
    for (const event of params.events) {
      await run(
        db,
        `INSERT INTO hazard_events (
          event_id,
          event_type,
          title,
          issued_at,
          occurred_at,
          latitude,
          longitude,
          location,
          magnitude,
          intensity,
          depth,
          description,
          image_url,
          raw_json,
          fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          event_type = excluded.event_type,
          title = excluded.title,
          issued_at = excluded.issued_at,
          occurred_at = excluded.occurred_at,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location = excluded.location,
          magnitude = excluded.magnitude,
          intensity = excluded.intensity,
          depth = excluded.depth,
          description = excluded.description,
          image_url = excluded.image_url,
          raw_json = excluded.raw_json,
          fetched_at = excluded.fetched_at,
          updated_at = CURRENT_TIMESTAMP`,
        [
          event.eventId,
          event.eventType,
          event.title,
          event.issuedAt,
          event.occurredAt,
          event.latitude,
          event.longitude,
          event.location,
          event.magnitude,
          event.intensity,
          event.depth,
          event.description,
          event.imageUrl,
          JSON.stringify(event.raw),
          params.fetchedAt,
        ],
      );
    }
  });
}
