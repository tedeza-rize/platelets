import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-sqlite-concurrency-"),
);
process.env.PLATELETS_DATA_DIR = dataDirectory;

const pointsDb = await import("@/lib/points-db");
const { incidentRepository } = await import(
  "@/lib/disaster-response/incident-repository"
);

test("SQLite writes fail fast on serverless deployment signals", async () => {
  const originalVercel = process.env.VERCEL;
  const originalMode = process.env.PLATELETS_SQLITE_WRITE_MODE;
  process.env.VERCEL = "1";
  delete process.env.PLATELETS_SQLITE_WRITE_MODE;

  try {
    const status = pointsDb.getSqliteWriteSafetyStatus();
    assert.equal(status.writesAllowed, false);
    assert.deepEqual(status.deploymentSignals, ["VERCEL"]);

    await assert.rejects(
      () => pointsDb.withDatabaseWriteTransaction(async () => undefined),
      /SQLite writes are disabled/,
    );
  } finally {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalMode === undefined) {
      delete process.env.PLATELETS_SQLITE_WRITE_MODE;
    } else {
      process.env.PLATELETS_SQLITE_WRITE_MODE = originalMode;
    }
  }
});

test("SQLite writes can be explicitly limited to single-process deployments", () => {
  const originalVercel = process.env.VERCEL;
  const originalMode = process.env.PLATELETS_SQLITE_WRITE_MODE;
  process.env.VERCEL = "1";
  process.env.PLATELETS_SQLITE_WRITE_MODE = "single-process";

  try {
    const status = pointsDb.getSqliteWriteSafetyStatus();
    assert.equal(status.mode, "single-process");
    assert.equal(status.writesAllowed, true);
  } finally {
    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalMode === undefined) {
      delete process.env.PLATELETS_SQLITE_WRITE_MODE;
    } else {
      process.env.PLATELETS_SQLITE_WRITE_MODE = originalMode;
    }
  }
});

test("point imports and incident writes share one transaction queue", async () => {
  const [incident] = await Promise.all([
    incidentRepository.createIncident({
      address: "서울특별시 중구",
      createdAt: "2026-06-13T00:00:00.000Z",
      description: "transaction queue test",
      latitude: 37.5665,
      longitude: 126.978,
      occurredAt: "2026-06-13T00:00:00.000Z",
      riskLevel: "medium",
      status: "reported",
      title: "Concurrent incident",
      type: "fire",
    }),
    pointsDb.replaceDataset({
      failedCount: 0,
      fetchedAt: "2026-06-13T00:00:00.000Z",
      geocodedCount: 1,
      points: [
        {
          address: "서울특별시 중구",
          category: "test",
          latitude: 37.5665,
          longitude: 126.978,
          name: "Concurrent point",
          parentName: null,
          phone: null,
          raw: {},
          source: "hospitals",
          sourceRecordId: "concurrent-point",
          sourceUpdatedAt: null,
        },
      ],
      skippedCount: 0,
      source: "hospitals",
    }),
  ]);

  assert.ok(incident.id.startsWith("inc-"));
  assert.equal((await pointsDb.listPoints({ source: "hospitals" })).length, 1);
  await pointsDb.closeDatabase();
});
