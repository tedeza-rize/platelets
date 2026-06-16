import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblyProtests,
  assemblyRoute,
  pointsDb,
  protest,
} from "./assembly-protests-helpers.ts";

test("all 18 provincial police agencies are crawlable sources", () => {
  assert.equal(assemblyProtests.ASSEMBLY_SOURCES.length, 18);
  assert.deepEqual(
    assemblyProtests.ASSEMBLY_SOURCES.map((source) => source.id).sort(),
    [
      "busan",
      "chungbuk",
      "chungnam",
      "daegu",
      "daejeon",
      "gangwon",
      "gwangju",
      "gyeongbuk",
      "gyeonggi-north",
      "gyeonggi-south",
      "gyeongnam",
      "incheon",
      "jeju",
      "jeonbuk",
      "jeonnam",
      "sejong",
      "seoul",
      "ulsan",
    ],
  );
});

test("replaceAssemblyProtestsForDate replaces one date without touching another date", async () => {
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-13",
    fetchedAt: "2026-06-12T15:00:00.000Z",
    protests: [
      protest({ location: "Seoul Plaza", sourceRecordId: "a" }),
      protest({ location: "Gwanghwamun Plaza", sourceRecordId: "b" }),
    ],
    sourceIds: ["seoul"],
  });
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-14",
    fetchedAt: "2026-06-13T15:00:00.000Z",
    protests: [
      protest({
        date: "2026-06-14",
        location: "Busan Station Plaza",
        sourceId: "busan",
        sourceRecordId: "c",
      }),
    ],
    sourceIds: ["busan"],
  });
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-13",
    fetchedAt: "2026-06-12T16:00:00.000Z",
    protests: [
      protest({
        crowdSize: 50,
        location: "Deoksugung Gate",
        sourceRecordId: "a",
      }),
    ],
    sourceIds: ["seoul"],
  });

  const targetDate = await pointsDb.listAssemblyProtests({
    date: "2026-06-13",
  });
  const otherDate = await pointsDb.listAssemblyProtests({
    date: "2026-06-14",
  });

  assert.equal(targetDate.length, 1);
  assert.equal(targetDate[0].location, "Deoksugung Gate");
  assert.equal(targetDate[0].crowdSize, 50);
  assert.deepEqual(targetDate[0].raw, { source: "unit" });
  assert.equal(otherDate.length, 1);
  assert.equal(otherDate[0].location, "Busan Station Plaza");
});

test("replaceAssemblyProtestsForDate only replaces selected sources", async () => {
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-15",
    fetchedAt: "2026-06-14T15:00:00.000Z",
    protests: [
      protest({
        date: "2026-06-15",
        location: "Seoul Station",
        sourceId: "seoul",
        sourceRecordId: "seoul-a",
      }),
      protest({
        date: "2026-06-15",
        location: "Incheon City Hall",
        sourceId: "incheon",
        sourceRecordId: "incheon-a",
      }),
    ],
    sourceIds: ["seoul", "incheon"],
  });
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-15",
    fetchedAt: "2026-06-14T16:00:00.000Z",
    protests: [
      protest({
        date: "2026-06-15",
        location: "Seoul Plaza",
        sourceId: "seoul",
        sourceRecordId: "seoul-b",
      }),
    ],
    sourceIds: ["seoul"],
  });

  const results = await pointsDb.listAssemblyProtests({
    date: "2026-06-15",
  });

  assert.deepEqual(
    results.map((result) => `${result.sourceId}:${result.location}`).sort(),
    ["incheon:Incheon City Hall", "seoul:Seoul Plaza"],
  );
});

test("GET /api/assembly-protests returns normalized rows without raw text", async () => {
  await pointsDb.replaceAssemblyProtestsForDate({
    date: "2026-06-16",
    fetchedAt: "2026-06-15T15:00:00.000Z",
    protests: [
      protest({
        crowdSize: 700,
        date: "2026-06-16",
        latitude: 37.5665,
        location: "Seoul Plaza",
        locationScope: "Sejong-daero",
        longitude: 126.978,
        raw: {
          detailText: "sensitive provider body",
          source: "unit",
        },
        sourceId: "seoul",
        sourceRecordId: "route-a",
        startsAt: "2026-06-16T10:00:00+09:00",
      }),
    ],
    sourceIds: ["seoul"],
  });

  const response = await assemblyRoute.GET(
    new Request("https://platelets.test/api/assembly-protests?date=2026-06-16"),
  );
  const body = (await response.json()) as {
    protests: Record<string, unknown>[];
  };

  assert.equal(response.status, 200);
  assert.equal(body.protests.length, 1);
  assert.equal(body.protests[0].location, "Seoul Plaza");
  assert.equal(body.protests[0].locationScope, "Sejong-daero");
  assert.equal(body.protests[0].crowdSize, 700);
  assert.equal(body.protests[0].latitude, 37.5665);
  assert.equal(body.protests[0].longitude, 126.978);
  assert.equal("raw" in body.protests[0], false);
});

test("GET /api/assembly-protests validates date and agency filters", async () => {
  const invalidDate = await assemblyRoute.GET(
    new Request("https://platelets.test/api/assembly-protests?date=20260616"),
  );
  const invalidAgency = await assemblyRoute.GET(
    new Request(
      "https://platelets.test/api/assembly-protests?date=2026-06-16&agency=unknown",
    ),
  );

  assert.equal(invalidDate.status, 400);
  assert.equal(invalidAgency.status, 400);
});
