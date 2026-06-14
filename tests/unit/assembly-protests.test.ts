import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { AssemblyProtestInput } from "@/lib/points-db";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-assembly-db-"),
);
process.env.PLATELETS_DATA_DIR = dataDirectory;

const pointsDb = await import("@/lib/points-db");
const assemblyProtests = await import("@/lib/assembly-protests");
const assemblyRoute = await import("@/app/api/assembly-protests/route");

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

function protest(
  patch: Partial<AssemblyProtestInput> &
    Pick<AssemblyProtestInput, "sourceRecordId">,
): AssemblyProtestInput {
  return {
    agency: "Seoul Metropolitan Police Agency",
    crowdSize: 30,
    date: "2026-06-13",
    detailUrl: "https://example.test/detail",
    endsAt: "2026-06-13T10:30:00+09:00",
    latitude: 37.5665,
    location: "Seoul Plaza",
    locationScope: "Seoul Plaza sidewalk",
    longitude: 126.978,
    raw: { source: "unit" },
    sourceId: "seoul",
    sourceTitle: "Daily assembly 260613",
    sourceUrl: "https://example.test/list",
    startsAt: "2026-06-13T10:00:00+09:00",
    ...patch,
  };
}

function buildTextPdf(lines: string[]) {
  const escapePdfText = (value: string) =>
    value.replace(/[\\()]/g, (match) => `\\${match}`);
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -18 Td",
      `(${escapePdfText(line)}) Tj`,
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

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
    protests: Array<Record<string, unknown>>;
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

test("crawlAssemblyProtests reports per-source success counts", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      "<table><tr><td>1</td><td>06.17 오늘의 집회</td></tr></table>",
      {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200,
      },
    );

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "daejeon",
      date: "2026-06-17",
      enrichLocations: false,
    });

    assert.equal(result.sourceCount, 1);
    assert.equal(result.failedSourceCount, 0);
    assert.equal(result.geocodedCount, 0);
    assert.equal(result.importedCount, 1);
    assert.deepEqual(result.sourceResults, [
      {
        agency: "Daejeon Metropolitan Police Agency",
        geocodedCount: 0,
        importedCount: 1,
        sourceId: "daejeon",
        status: "success",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crawlAssemblyProtests reports per-source failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "daejeon",
      date: "2026-06-18",
      enrichLocations: false,
    });

    assert.equal(result.sourceCount, 1);
    assert.equal(result.failedSourceCount, 1);
    assert.equal(result.geocodedCount, 0);
    assert.equal(result.importedCount, 0);
    assert.equal(
      result.sourceResults[0].agency,
      "Daejeon Metropolitan Police Agency",
    );
    assert.equal(result.sourceResults[0].geocodedCount, 0);
    assert.equal(result.sourceResults[0].sourceId, "daejeon");
    assert.equal(result.sourceResults[0].status, "failure");
    assert.equal(result.sourceResults[0].importedCount, 0);
    assert.equal(result.sourceResults[0].error, "network down");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crawlAssemblyProtests stores bounded coordinate resolver results", async () => {
  const originalFetch = globalThis.fetch;
  const html =
    "<table><tr><td>1</td><td>06.19 \uC624\uB298\uC758 \uC9D1\uD68C</td></tr></table>";
  globalThis.fetch = async () =>
    new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200,
    });

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "daejeon",
      coordinateResolver: async (params) => ({
        latitude: 36.3504,
        longitude: 127.3845,
        matchedAddress: params.location,
        query: `\uB300\uC804 ${params.location}`,
        source: "unit-map-tool",
      }),
      date: "2026-06-19",
      enrichLocations: true,
    });

    const stored = await pointsDb.listAssemblyProtests({
      date: "2026-06-19",
    });

    assert.equal(result.importedCount, 1);
    assert.equal(result.geocodedCount, 1);
    assert.equal(result.sourceResults[0].geocodedCount, 1);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].latitude, 36.3504);
    assert.equal(stored[0].longitude, 127.3845);
    assert.deepEqual(stored[0].raw.geocoding, {
      latitude: 36.3504,
      longitude: 127.3845,
      matchedAddress: stored[0].location,
      query: `\uB300\uC804 ${stored[0].location}`,
      source: "unit-map-tool",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crawlAssemblyProtests rejects coordinate resolver results outside Korea", async () => {
  const originalFetch = globalThis.fetch;
  const html =
    "<table><tr><td>1</td><td>06.20 \uC624\uB298\uC758 \uC9D1\uD68C</td></tr></table>";
  globalThis.fetch = async () =>
    new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200,
    });

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "daejeon",
      coordinateResolver: async () => ({
        latitude: 35,
        longitude: 100,
        matchedAddress: null,
        query: "outside-korea",
        source: "unit-map-tool",
      }),
      date: "2026-06-20",
      enrichLocations: true,
    });

    const stored = await pointsDb.listAssemblyProtests({
      date: "2026-06-20",
    });

    assert.equal(result.importedCount, 1);
    assert.equal(result.geocodedCount, 0);
    assert.equal(result.sourceResults[0].geocodedCount, 0);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].latitude, null);
    assert.equal(stored[0].longitude, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parseGeocodePlaceToolArguments ignores model-supplied coordinates", () => {
  assert.deepEqual(
    assemblyProtests.parseGeocodePlaceToolArguments(
      JSON.stringify({
        latitude: 37.1,
        longitude: 127.1,
        query: "  \uB300\uC804\uC5ED 1\uBC88\uCD9C\uAD6C  ",
        searchMode: "keyword",
      }),
    ),
    {
      query: "\uB300\uC804\uC5ED 1\uBC88\uCD9C\uAD6C",
      searchMode: "keyword",
    },
  );
});

test("assembly coordinate enrichment exposes a geocode_place tool contract", () => {
  assert.equal(
    assemblyProtests.ASSEMBLY_GEOCODE_PLACE_TOOL.function.name,
    "geocode_place",
  );
  assert.deepEqual(
    assemblyProtests.ASSEMBLY_GEOCODE_PLACE_TOOL.function.parameters.required,
    ["query", "searchMode"],
  );
});

test("buildAssemblyGeocodingCandidates prefixes agencies and normalizes exits", () => {
  assert.deepEqual(
    assemblyProtests.buildAssemblyGeocodingCandidates({
      agency: "seoul",
      location: "\uC11C\uCD08\uC5ED8\u51FA",
      locationScope: "\uAC15\uB0A8\uB300\uB85C \uB4F1",
    }),
    [
      "\uC11C\uC6B8 \uC11C\uCD08\uC5ED 8\uBC88\uCD9C\uAD6C",
      "\uC11C\uC6B8 \uAC15\uB0A8\uB300\uB85C \uB4F1",
      "\uC11C\uCD08\uC5ED 8\uBC88\uCD9C\uAD6C",
      "\uAC15\uB0A8\uB300\uB85C \uB4F1",
    ],
  );
});

test("buildAssemblyGeocodingCandidates uses the first march segment", () => {
  assert.deepEqual(
    assemblyProtests.buildAssemblyGeocodingCandidates({
      agency: "busan",
      location: "\uC11C\uBA74 \uD558\uD2B8\uC870\uD615\uBB3C \uC55E",
      locationScope:
        "\uD558\uD2B8->\uB180\uC774\uB9C8\uB8E8->\uD558\uD2B8(2.4km, 1\uAC1C\uCC28\uB85C)",
    }),
    [
      "\uBD80\uC0B0 \uC11C\uBA74 \uD558\uD2B8\uC870\uD615\uBB3C \uC55E",
      "\uBD80\uC0B0 \uD558\uD2B8",
      "\uC11C\uBA74 \uD558\uD2B8\uC870\uD615\uBB3C \uC55E",
      "\uD558\uD2B8",
    ],
  );
});

test("extractTextFromAssemblyAttachment reads valid PDF text with PDF.js", async () => {
  const buffer = buildTextPdf(["Time: 10:00~12:00", "Place: Seoul Plaza"]);
  const text = await assemblyProtests.extractTextFromAssemblyAttachment({
    buffer,
    contentType: "application/pdf",
    url: "https://example.test/assembly.pdf",
  });

  assert.match(text, /Time: 10:00~12:00/);
  assert.match(text, /Place: Seoul Plaza/);
});
