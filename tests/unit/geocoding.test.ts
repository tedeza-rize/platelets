import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-geocoding-"));
process.env.PLATELETS_DATA_DIR = dataDirectory;
process.env.KAKAO_REST_API_KEY = "kakao-test-key";
process.env.VWORLD_API_KEY = "vworld-test-key";

const pointsDb = await import("@/lib/points-db");
const databaseQuery = await import("@/lib/database/query");
const geocoding = await import("@/lib/geocoding");

test("searchMapCoordinates falls back to VWorld when Kakao quota is exhausted", async () => {
  const db = await pointsDb.getDatabase();
  await databaseQuery.runDatabase(
    db,
    `INSERT INTO api_usage_windows (
      provider,
      registered_at,
      window_started_at,
      window_ends_at,
      used_count,
      monthly_limit
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "kakao-local",
      "2026-06-14T00:00:00.000Z",
      "2026-06-14T00:00:00.000Z",
      "2999-01-01T00:00:00.000Z",
      100_000,
      100_000,
    ],
  );

  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    assert.match(url, /api\.vworld\.kr\/req\/address/);
    assert.match(url, /request=getCoord/);

    return Response.json({
      response: {
        refined: { text: "서울특별시 중구 세종대로 110" },
        result: { point: { x: "126.978", y: "37.5665" } },
        status: "OK",
      },
    });
  };

  try {
    const result = await geocoding.searchMapCoordinates({
      kind: "address",
      query: "서울특별시 중구 세종대로 110",
    });

    assert.equal(result?.source, "vworld-address-road");
    assert.equal(result?.latitude, 37.5665);
    assert.equal(result?.longitude, 126.978);
    assert.equal(requestedUrls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await pointsDb.closeDatabase();
  }
});

test("searchVworldLocations returns bounded normalized search results", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      response: {
        result: {
          items: [
            {
              address: { road: "서울특별시 중구 세종대로 110" },
              point: { x: "126.978", y: "37.5665" },
              title: "서울특별시청",
            },
          ],
        },
        status: "OK",
      },
    });

  try {
    const [result] = await geocoding.searchVworldLocations({
      limit: 1,
      query: "서울시청",
      searchMode: "both",
    });

    assert.equal(result.title, "서울특별시청");
    assert.equal(result.matchedAddress, "서울특별시 중구 세종대로 110");
    assert.equal(result.source, "vworld-search-place");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
