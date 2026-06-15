import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { copyDatabaseContents } from "@/lib/database/migration";
import { initializeDatabaseSchema } from "@/lib/database/schema";
import { openSqliteClient } from "@/lib/database/sqlite-adapter";

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
