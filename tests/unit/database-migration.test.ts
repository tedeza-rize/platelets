import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { copyDatabaseContents } from "@/lib/database/migration";
import { initializeDatabaseSchema } from "@/lib/database/schema";
import { openSqliteClient } from "@/lib/database/sqlite-adapter";
import type { DatabaseClient } from "@/lib/database/types";

async function insertIncident(db: DatabaseClient, id: string) {
  await db.run(
    `INSERT INTO disaster_incidents (
      id, type, title, description, address, latitude, longitude, risk_level,
      status, occurred_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "fire",
      "Integrity incident",
      "Schema integrity test",
      "Seoul",
      37.5,
      127,
      "medium",
      "reported",
      "2026-06-16T00:00:00.000Z",
      "2026-06-16T00:00:00.000Z",
      "2026-06-16T00:00:00.000Z",
    ],
  );
}

async function insertIncidentEvent(db: DatabaseClient, incidentId: string) {
  await db.run(
    `INSERT INTO disaster_incident_events (
      id, incident_id, type, message, from_status, to_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `evt-${incidentId}`,
      incidentId,
      "created",
      "Incident created",
      null,
      "reported",
      "2026-06-16T00:00:00.000Z",
    ],
  );
}

test("copyDatabaseContents replaces target rows with a consistent source copy", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "platelets-migration-"));
  const source = openSqliteClient(path.join(directory, "source.sqlite"));
  const target = openSqliteClient(path.join(directory, "target.sqlite"));

  try {
    await initializeDatabaseSchema(source);
    await initializeDatabaseSchema(target);
    await source.run(
      `INSERT INTO app_settings (key, value_json)
       VALUES (?, ?)`,
      ["migration-setting", JSON.stringify({ enabled: true })],
    );
    await source.run(
      `INSERT INTO points (
        source, source_record_id, name, category, address, phone, parent_name,
        latitude, longitude, source_updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "fire-stations",
        "station-1",
        "Migration Station",
        "fire_station",
        "Seoul",
        null,
        null,
        37.5,
        127,
        null,
        "{}",
      ],
    );
    await target.run(
      `INSERT INTO app_settings (key, value_json)
       VALUES (?, ?)`,
      ["stale-setting", JSON.stringify({ stale: true })],
    );

    const counts = await copyDatabaseContents(source, target);
    const settings = await target.all<{ key: string }>(
      "SELECT key FROM app_settings ORDER BY key",
    );
    const points = await target.all<{ name: string }>(
      "SELECT name FROM points ORDER BY id",
    );

    assert.equal(counts.app_settings, 1);
    assert.equal(counts.points, 1);
    assert.deepEqual(settings, [{ key: "migration-setting" }]);
    assert.deepEqual(points, [{ name: "Migration Station" }]);
  } finally {
    await source.close();
    await target.close();
  }
});

test("incident event schema enforces parent incident integrity", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "platelets-fk-"));
  const db = openSqliteClient(path.join(directory, "events.sqlite"));

  try {
    await initializeDatabaseSchema(db);
    await insertIncident(db, "inc-parent");
    await insertIncidentEvent(db, "inc-parent");

    await assert.rejects(
      () => insertIncidentEvent(db, "inc-missing"),
      /FOREIGN KEY constraint failed/,
    );
    await assert.rejects(
      () =>
        db.run("DELETE FROM disaster_incidents WHERE id = ?", ["inc-parent"]),
      /FOREIGN KEY constraint failed/,
    );
  } finally {
    await db.close();
  }
});

test("legacy SQLite incident event tables are rebuilt with foreign keys", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "platelets-fk-migration-"));
  const db = openSqliteClient(path.join(directory, "legacy.sqlite"));

  try {
    await db.run(`
      CREATE TABLE disaster_incidents (
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
      );
      CREATE TABLE disaster_incident_events (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        created_at TEXT NOT NULL
      );
    `);
    await insertIncident(db, "inc-legacy");
    await insertIncidentEvent(db, "inc-legacy");

    await initializeDatabaseSchema(db);

    const foreignKeys = await db.all<{ from: string; table: string }>(
      'PRAGMA foreign_key_list("disaster_incident_events")',
    );
    assert.deepEqual(
      foreignKeys.map((key) => [key.from, key.table]),
      [["incident_id", "disaster_incidents"]],
    );
    await assert.rejects(
      () => insertIncidentEvent(db, "inc-missing"),
      /FOREIGN KEY constraint failed/,
    );
  } finally {
    await db.close();
  }
});

test("incident event migration purges legacy orphan rows", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "platelets-fk-orphan-"));
  const db = openSqliteClient(path.join(directory, "orphan.sqlite"));

  try {
    await db.run(`
      CREATE TABLE disaster_incidents (
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
      );
      CREATE TABLE disaster_incident_events (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        created_at TEXT NOT NULL
      );
    `);
    await insertIncident(db, "inc-kept");
    await insertIncidentEvent(db, "inc-kept");
    await insertIncidentEvent(db, "inc-orphan");

    await initializeDatabaseSchema(db);

    const remaining = await db.all<{ id: string }>(
      "SELECT id FROM disaster_incident_events ORDER BY id",
    );
    assert.deepEqual(
      remaining.map((row) => row.id),
      ["evt-inc-kept"],
    );

    const foreignKeys = await db.all<{ from: string; table: string }>(
      'PRAGMA foreign_key_list("disaster_incident_events")',
    );
    assert.deepEqual(
      foreignKeys.map((key) => [key.from, key.table]),
      [["incident_id", "disaster_incidents"]],
    );
  } finally {
    await db.close();
  }
});
