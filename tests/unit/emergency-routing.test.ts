import assert from "node:assert/strict";
import test from "node:test";
import { haversineMeters } from "@/lib/emergency-routing";

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
