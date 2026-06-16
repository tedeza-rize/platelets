import { allDatabase as all } from "@/lib/database/query";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { encodeListingCursor, readCursorRecord } from "@/lib/listing-cursors";
import type { ApiLogEntry, ApiLogInput } from "@/lib/points-db";
import { getDatabase } from "@/lib/points-db-modules/connection";

export type ApiLogCursor = {
  eventAt: string;
  id: number;
};

type ApiLogRow = {
  action: string;
  category: ApiLogInput["category"];
  event_at: string;
  id: number;
  level: ApiLogInput["level"];
  message: string;
  metadata_json: string;
  request_count: number;
  source: DatasetSourceId | null;
  status: ApiLogInput["status"];
};

function clampLogLimit(value: number | undefined) {
  return Math.min(Math.max(Math.trunc(value ?? 200), 1), 500);
}

function mapApiLogRow(row: ApiLogRow): ApiLogEntry {
  return {
    action: row.action,
    category: row.category,
    eventAt: row.event_at,
    id: row.id,
    level: row.level,
    message: row.message,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    requestCount: row.request_count,
    source: row.source,
    status: row.status,
  };
}

export function validateApiLogCursor(value: unknown): ApiLogCursor | null {
  const record = readCursorRecord(value);

  if (
    !record ||
    typeof record.eventAt !== "string" ||
    typeof record.id !== "number" ||
    !Number.isSafeInteger(record.id) ||
    record.id < 1
  ) {
    return null;
  }

  return { eventAt: record.eventAt, id: record.id };
}

function nextApiLogCursor(rows: ApiLogRow[], limit: number) {
  if (rows.length <= limit) return null;

  const last = rows[limit - 1];
  return encodeListingCursor({ eventAt: last.event_at, id: last.id });
}

export async function listApiLogPage(
  options: {
    category?: ApiLogInput["category"] | null;
    cursor?: ApiLogCursor | null;
    limit?: number;
    source?: DatasetSourceId | null;
  } = {},
) {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];
  const limit = clampLogLimit(options.limit);

  if (options.category) {
    conditions.push("l.category = ?");
    params.push(options.category);
  }

  if (options.source) {
    conditions.push("l.source = ?");
    params.push(options.source);
  }

  if (options.cursor) {
    conditions.push("(l.event_at < ? OR (l.event_at = ? AND l.id < ?))");
    params.push(
      options.cursor.eventAt,
      options.cursor.eventAt,
      options.cursor.id,
    );
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all<ApiLogRow>(
    db,
    `SELECT l.*
      FROM api_logs l
      ${where}
      ORDER BY l.event_at DESC, l.id DESC
      LIMIT ?`,
    [...params, limit + 1],
  );

  return {
    logs: rows.slice(0, limit).map(mapApiLogRow),
    nextCursor: nextApiLogCursor(rows, limit),
  };
}
