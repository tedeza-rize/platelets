import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  EmergencyPointInput,
  findNearestPoints as FindNearestPoints,
  replaceDataset as ReplaceDataset,
} from "@/lib/points-db";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-unit-db-"));
process.env.PLATELETS_DATA_DIR = dataDirectory;

const pointsDb = await import("@/lib/points-db");
const replaceDataset: typeof ReplaceDataset = pointsDb.replaceDataset;
const findNearestPoints: typeof FindNearestPoints = pointsDb.findNearestPoints;

function point(
  patch: Partial<EmergencyPointInput> & Pick<EmergencyPointInput, "name">,
): EmergencyPointInput {
  return {
    address: `${patch.name} address`,
    category: "테스트",
    latitude: 37.5665,
    longitude: 126.978,
    parentName: null,
    phone: "02-0000-0000",
    raw: {},
    source: "hospitals",
    sourceRecordId: patch.name,
    sourceUpdatedAt: "2026-06-12T00:00:00+09:00",
    ...patch,
  };
}

test("findNearestPoints sorts mapped points by haversine distance", async () => {
  await replaceDataset({
    failedCount: 0,
    fetchedAt: "2026-06-12T00:00:00.000Z",
    geocodedCount: 3,
    points: [
      point({ name: "far", latitude: 37.58, longitude: 127.02 }),
      point({ name: "near", latitude: 37.5666, longitude: 126.9781 }),
      point({ name: "unmapped", latitude: null, longitude: null }),
    ],
    skippedCount: 0,
    source: "hospitals",
  });

  const results = await findNearestPoints({
    latitude: 37.5665,
    limit: 5,
    longitude: 126.978,
    radiusMeters: 10_000,
    source: "hospitals",
  });

  assert.deepEqual(
    results.map((result) => result.name),
    ["near", "far"],
  );
  assert.ok(results[0].distanceMeters < results[1].distanceMeters);
});

test("findNearestPoints clamps very large radiuses to 100km", async () => {
  await replaceDataset({
    failedCount: 0,
    fetchedAt: "2026-06-12T00:00:00.000Z",
    geocodedCount: 2,
    points: [
      point({ name: "inside", latitude: 37.5666, longitude: 126.9781 }),
      point({ name: "outside", latitude: 38.8, longitude: 126.978 }),
    ],
    skippedCount: 0,
    source: "hospitals",
  });

  const results = await findNearestPoints({
    latitude: 37.5665,
    limit: 10,
    longitude: 126.978,
    radiusMeters: 1_000_000,
    source: "hospitals",
  });

  assert.deepEqual(
    results.map((result) => result.name),
    ["inside"],
  );
});

test("listPoints binds source filters instead of treating them as SQL", async () => {
  await replaceDataset({
    failedCount: 0,
    fetchedAt: "2026-06-12T00:00:00.000Z",
    geocodedCount: 1,
    points: [point({ name: "bound-source" })],
    skippedCount: 0,
    source: "hospitals",
  });

  const results = await pointsDb.listPoints({
    source: "hospitals' OR 1 = 1 --" as EmergencyPointInput["source"],
  });

  assert.deepEqual(results, []);
});
