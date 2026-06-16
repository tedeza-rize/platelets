import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblyProtests,
  buildTextPdf,
  pointsDb,
} from "./assembly-protests-helpers.ts";

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

test("crawlAssemblyProtests fetches independent agency sources in parallel", async () => {
  const originalFetch = globalThis.fetch;
  let activeFetches = 0;
  let peakFetches = 0;

  globalThis.fetch = async (input) => {
    activeFetches += 1;
    peakFetches = Math.max(peakFetches, activeFetches);
    await new Promise((resolve) => setTimeout(resolve, 20));
    activeFetches -= 1;

    const url = String(input);
    if (url.includes("getBbsList.do")) {
      return Response.json({ list: [] });
    }

    return new Response("<table></table>", {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200,
    });
  };

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      date: "2026-06-22",
      enrichLocations: false,
    });

    assert.equal(result.sourceCount, 18);
    assert.equal(result.failedSourceCount, 0);
    assert.equal(result.importedCount, 0);
    assert.ok(peakFetches > 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crawlAssemblyProtests stores bounded coordinate resolver results", async () => {
  const originalFetch = globalThis.fetch;
  const html =
    // biome-ignore lint/security/noSecrets: Encoded Korean fixture text is not a credential.
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
    // biome-ignore lint/security/noSecrets: Encoded Korean fixture text is not a credential.
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

test("crawlAssemblyProtests resolves independent parsed locations in parallel", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      list: [
        {
          CPDS_CONTENT: [
            "일시 : 10:00~11:00 장소 : 창원광장 인원 : 20명",
            "일시 : 12:00~13:00 장소 : 경남도청 인원 : 30명",
          ].join(" "),
          CPDS_SUBJECT: "06.21 오늘의 집회",
          IPDS_IDX: "parallel",
        },
      ],
    });

  let activeResolvers = 0;
  let peakResolvers = 0;

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "gyeongnam",
      coordinateResolver: async (params) => {
        activeResolvers += 1;
        peakResolvers = Math.max(peakResolvers, activeResolvers);
        await new Promise((resolve) => setTimeout(resolve, 25));
        activeResolvers -= 1;

        return {
          latitude: params.location.includes("도청") ? 35.237 : 35.227,
          longitude: params.location.includes("도청") ? 128.691 : 128.681,
          matchedAddress: params.location,
          query: `경남 ${params.location}`,
          source: "unit-map-tool",
        };
      },
      date: "2026-06-21",
      enrichLocations: true,
    });

    const stored = await pointsDb.listAssemblyProtests({
      date: "2026-06-21",
    });

    assert.equal(result.importedCount, 2);
    assert.equal(result.geocodedCount, 2);
    assert.equal(peakResolvers, 2);
    assert.deepEqual(
      stored.map((row) => row.location),
      ["창원광장", "경남도청"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("crawlAssemblyProtests reuses cached default geocoding results", async () => {
  await pointsDb.saveAssemblyGeocodeCacheEntry({
    latitude: 35.227,
    longitude: 128.681,
    matchedAddress: "\uCC3D\uC6D0\uAD11\uC7A5",
    query: "\uACBD\uB0A8 \uCC3D\uC6D0\uAD11\uC7A5",
    searchMode: "both",
    source: "kakao-local-keyword",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      list: [
        {
          CPDS_CONTENT:
            "\uC77C\uC2DC : 10:00~11:00 \uC7A5\uC18C : \uCC3D\uC6D0\uAD11\uC7A5 \uC778\uC6D0 : 20\uBA85",
          // biome-ignore lint/security/noSecrets: Encoded Korean fixture text is not a credential.
          CPDS_SUBJECT: "06.24 \uC624\uB298\uC758 \uC9D1\uD68C",
          IPDS_IDX: "cached-geocode",
        },
      ],
    });

  try {
    const result = await assemblyProtests.crawlAssemblyProtests({
      agency: "gyeongnam",
      date: "2026-06-24",
      enrichLocations: true,
    });
    const stored = await pointsDb.listAssemblyProtests({
      date: "2026-06-24",
    });

    assert.equal(result.importedCount, 1);
    assert.equal(result.geocodedCount, 1);
    assert.equal(stored[0].latitude, 35.227);
    assert.equal(stored[0].longitude, 128.681);
    assert.deepEqual(stored[0].raw.geocoding, {
      latitude: 35.227,
      longitude: 128.681,
      matchedAddress: "\uCC3D\uC6D0\uAD11\uC7A5",
      query: "\uACBD\uB0A8 \uCC3D\uC6D0\uAD11\uC7A5",
      source: "assembly-geocode-cache:kakao-local-keyword",
    });
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
