import { allDatabase as all, runDatabase as run } from "@/lib/database/query";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { getDatabase } from "@/lib/points-db-modules/connection";
import { buildWhitelistedWhereClause } from "@/lib/points-db-modules/sql-utils";
import type { ApiLogEntry, ApiLogInput } from "@/lib/points-db-types";

const API_LOG_WHERE_CLAUSES = {
  category: "category = ?",
  source: "source = ?",
} as const;

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

export async function listApiLogs(
  options: {
    category?: ApiLogInput["category"] | null;
    limit?: number;
    source?: DatasetSourceId | null;
  } = {},
) {
  const db = await getDatabase();
  const conditions: Array<keyof typeof API_LOG_WHERE_CLAUSES> = [];
  const params: unknown[] = [];
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  if (options.category) {
    conditions.push("category");
    params.push(options.category);
  }

  if (options.source) {
    conditions.push("source");
    params.push(options.source);
  }

  const where = buildWhitelistedWhereClause(conditions, API_LOG_WHERE_CLAUSES);
  const rows = await all<ApiLogRow>(
    db,
    `SELECT * FROM api_logs ${where} ORDER BY event_at DESC, id DESC LIMIT ?`,
    [...params, limit],
  );

  return rows.map(mapApiLogRow);
}

export async function recordApiLog(input: ApiLogInput) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO api_logs (
      level,
      category,
      source,
      action,
      status,
      message,
      request_count,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.level,
      input.category,
      input.source ?? null,
      input.action,
      input.status,
      input.message,
      input.requestCount ?? 0,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
