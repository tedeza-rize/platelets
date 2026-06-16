import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeDatabaseConfig } from "@/lib/database/config";
import { initializeDatabaseSchema } from "@/lib/database/schema";
import { databaseSql } from "@/lib/database/sql";
import { openSqliteClient } from "@/lib/database/sqlite-adapter";

test("databaseSql converts placeholders for PostgreSQL", () => {
  assert.equal(
    databaseSql(
      "SELECT * FROM points WHERE source = ? AND name LIKE ?",
      "postgresql",
    ),
    "SELECT * FROM points WHERE source = $1 AND name LIKE $2",
  );
});

test("databaseSql converts SQLite upserts for MySQL and MariaDB", () => {
  assert.equal(
    databaseSql(
      `INSERT INTO app_settings (key, value_json)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      "mysql",
    )
      .replace(/\s+/gu, " ")
      .trim(),
    "INSERT INTO app_settings (key, value_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)",
  );
});

test("normalizeDatabaseConfig accepts supported external database URLs", () => {
  assert.deepEqual(
    normalizeDatabaseConfig({
      connectionString: "postgresql://db.example.com/platelets",
      engine: "postgresql",
    }),
    {
      connectionString: "postgresql://db.example.com/platelets",
      engine: "postgresql",
    },
  );
  assert.deepEqual(
    normalizeDatabaseConfig({
      connectionString: "mysql://db.example.com/platelets",
      engine: "mariadb",
    }),
    {
      connectionString: "mysql://db.example.com/platelets",
      engine: "mariadb",
    },
  );
});

test("normalizeDatabaseConfig rejects mismatched or unsupported database URLs", () => {
  assert.throws(
    () =>
      normalizeDatabaseConfig({
        connectionString: "mysql://db.example.com/platelets",
        engine: "postgresql",
      }),
    /Database connection address is invalid/,
  );
  assert.throws(
    () =>
      normalizeDatabaseConfig({
        connectionString: "postgresql://db.example.com/platelets",
        engine: "oracle",
      }),
    /Database engine is not supported/,
  );
});

test("schema creates aggregate point lookup indexes", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "platelets-schema-"));
  const db = openSqliteClient(path.join(directory, "points.sqlite"));

  try {
    await initializeDatabaseSchema(db);
    const indexes = await db.all<{ name: string }>("PRAGMA index_list(points)");
    const names = new Set(indexes.map((index) => index.name));

    assert.equal(names.has("points_source_coordinates_idx"), true);
    assert.equal(names.has("points_source_id_idx"), true);
  } finally {
    await db.close();
    rmSync(directory, { force: true, recursive: true });
  }
});
