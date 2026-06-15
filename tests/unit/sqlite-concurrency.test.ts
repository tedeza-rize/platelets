import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-sqlite-concurrency-"),
);
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const { incidentRepository } = await import(
  "@/lib/disaster-response/incident-repository"
);

test("SQLite writes fail fast on serverless deployment signals", async () => {
  const originalVercel = process.env.VERCEL;
  process.env.VERCEL = "1";

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
