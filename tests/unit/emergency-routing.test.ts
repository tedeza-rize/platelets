import assert from "node:assert/strict";
import test from "node:test";
import { haversineMeters } from "@/lib/emergency-routing";
import {
  clearEmergencyRoutingCachesForTests,
  getOrLoadRoadGraph,
  getOrLoadRoute,
  routingCacheStats,
} from "@/lib/emergency-routing-cache";
import {
  createRoadNodeIndex,
  nearestRoadNode,
} from "@/lib/emergency-routing-spatial-index";

test("haversineMeters returns zero for identical coordinates", () => {
  const distance = haversineMeters(
    {
      latitude: 37.5665,
      longitude: 126.978,
    },
    {
      latitude: 37.5665,
      longitude: 126.978,
    },
  );

  assert.equal(distance, 0);
});

test("haversineMeters calculates a stable one-degree equator distance", () => {
  const distance = haversineMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
  );

  assert.ok(distance > 111_000);
  assert.ok(distance < 111_400);
});

test("road graph cache deduplicates in-flight loads", async () => {
  clearEmergencyRoutingCachesForTests();
  let loadCount = 0;
  const load = async () => {
    loadCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { id: "shared" };
  };

  const [left, right] = await Promise.all([
    getOrLoadRoadGraph("same-bounds", load),
    getOrLoadRoadGraph("same-bounds", load),
  ]);

  assert.equal(loadCount, 1);
  assert.equal(left, right);
  assert.equal(routingCacheStats().graphEntries, 1);
});

test("road graph cache evicts least recently used entries", async () => {
  clearEmergencyRoutingCachesForTests();

  for (let index = 0; index < 14; index += 1) {
    await getOrLoadRoadGraph(`bounds-${index}`, async () => ({ index }));
  }

  assert.equal(routingCacheStats().graphEntries, 12);
});

test("route cache reuses recent origin-destination results", async () => {
  clearEmergencyRoutingCachesForTests();
  let loadCount = 0;

  const first = await getOrLoadRoute("route-key", async () => {
    loadCount += 1;
    return { durationSeconds: 120 };
  });
  const second = await getOrLoadRoute("route-key", async () => {
    loadCount += 1;
    return { durationSeconds: 180 };
  });

  assert.equal(loadCount, 1);
  assert.equal(first.durationSeconds, 120);
  assert.equal(second.durationSeconds, 120);
});

test("road node index finds nearby nodes without scanning every node", () => {
  const index = createRoadNodeIndex(
    new Map([
      [1, { latitude: 37.5665, longitude: 126.978 }],
      [2, { latitude: 37.58, longitude: 127.03 }],
    ]),
  );

  assert.equal(
    nearestRoadNode(index, { latitude: 37.5666, longitude: 126.9781 }),
    1,
  );
  assert.throws(() =>
    nearestRoadNode(index, { latitude: 35.0, longitude: 129.0 }),
  );
});
