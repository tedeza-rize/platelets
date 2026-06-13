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
