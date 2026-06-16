import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";
import type { EmergencyPointInput } from "@/lib/points-db";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-listing-"));
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const setupState = await import("@/lib/setup-state");
const authSessions = await import("@/lib/auth-sessions");
const logsRoute = await import("@/app/api/logs/route");
const pointsRoute = await import("@/app/api/points/route");

test.after(async () => {
  await pointsDb.closeDatabase();
});

const adminPassword = "StrongAdminPass1!";
const sudoPassword = "StrongSudoPass1!";

async function ensureSetup() {
  if (await setupState.isSetupComplete()) return;

  await setupState.completeSetup({
    admin: {
      email: "admin@example.com",
      fullName: "Setup Admin",
      password: adminPassword,
    },
    apiKeys: {},
    licenseAccepted: true,
    sudo: {
      email: "sudo@example.com",
      fullName: "Setup Sudo",
      password: sudoPassword,
    },
  });
}

function point(name: string): EmergencyPointInput {
  return {
    address: `${name} address`,
    category: "test",
    latitude: 37.5665,
    longitude: 126.978,
    name,
    parentName: null,
    phone: null,
    raw: {},
    source: "hospitals",
    sourceRecordId: name,
    sourceUpdatedAt: "2026-06-16T00:00:00.000Z",
  };
}

async function sudoRequest(pathname: string) {
  await ensureSetup();
  const session = await authSessions.createAccessSession(sudoPassword, "sudo");
  if (!session) {
    throw new Error("sudo_session_missing");
  }

  return new NextRequest(`http://platelets.local${pathname}`, {
    headers: {
      cookie: `${authSessions.SESSION_COOKIE_NAME}=${session.token}`,
    },
  });
}

test("listing indexes are created for cursor query plans", async () => {
  await ensureSetup();
  const db = await pointsDb.getDatabase();
  const pointIndexes = await db.all<{ name: string }>(
    "PRAGMA index_list('points')",
  );
  const logIndexes = await db.all<{ name: string }>(
    "PRAGMA index_list('api_logs')",
  );
  const pointPlan = await db.all<{ detail: string }>(
    "EXPLAIN QUERY PLAN SELECT id FROM points WHERE source = ? AND id > ? ORDER BY id ASC LIMIT ?",
    ["hospitals", 0, 10],
  );
  const logPlan = await db.all<{ detail: string }>(
    "EXPLAIN QUERY PLAN SELECT * FROM api_logs ORDER BY event_at DESC, id DESC LIMIT ?",
    [10],
  );

  assert.ok(
    pointIndexes.some((index) => index.name === "points_source_id_idx"),
  );
  assert.ok(logIndexes.some((index) => index.name === "api_logs_event_id_idx"));
  assert.ok(
    logIndexes.some((index) => index.name === "api_logs_category_event_id_idx"),
  );
  assert.match(
    pointPlan.map((entry) => entry.detail).join(" "),
    /USING COVERING INDEX/,
  );
  assert.match(
    logPlan.map((entry) => entry.detail).join(" "),
    /api_logs_event_id_idx/,
  );
});

test("logs API returns stable cursor pages", async () => {
  await ensureSetup();
  const db = await pointsDb.getDatabase();
  await db.run("DELETE FROM api_logs");

  for (const message of ["first", "second", "third"]) {
    await db.run(
      `INSERT INTO api_logs (
        event_at, level, category, source, action, status, message,
        request_count, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "2026-06-16T00:00:00.000Z",
        "info",
        "system",
        null,
        "test",
        "success",
        message,
        0,
        "{}",
      ],
    );
  }

  const firstResponse = await logsRoute.GET(
    await sudoRequest("/api/logs?limit=2&category=system"),
  );
  const firstPage = (await firstResponse.json()) as {
    logs: Array<{ message: string }>;
    nextCursor: string | null;
  };
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(
    firstPage.logs.map((log) => log.message),
    ["third", "second"],
  );
  assert.equal(typeof firstPage.nextCursor, "string");

  const secondResponse = await logsRoute.GET(
    await sudoRequest(
      `/api/logs?limit=2&category=system&cursor=${encodeURIComponent(
        firstPage.nextCursor ?? "",
      )}`,
    ),
  );
  const secondPage = (await secondResponse.json()) as {
    logs: Array<{ message: string }>;
    nextCursor: string | null;
  };

  assert.deepEqual(
    secondPage.logs.map((log) => log.message),
    ["first"],
  );
  assert.equal(secondPage.nextCursor, null);
});

test("points API returns cursor pages for summary listings", async () => {
  await pointsDb.replaceDataset({
    failedCount: 0,
    fetchedAt: "2026-06-16T00:00:00.000Z",
    geocodedCount: 3,
    points: [point("alpha"), point("bravo"), point("charlie")],
    skippedCount: 0,
    source: "hospitals",
  });

  const firstResponse = await pointsRoute.GET(
    new NextRequest(
      "http://platelets.local/api/points?source=hospitals&detail=summary&limit=2",
    ),
  );
  const firstPage = (await firstResponse.json()) as {
    nextCursor: string | null;
    points: Array<{ name: string }>;
  };

  assert.equal(firstResponse.status, 200);
  assert.deepEqual(
    firstPage.points.map((current) => current.name),
    ["alpha", "bravo"],
  );
  assert.equal(typeof firstPage.nextCursor, "string");

  const secondResponse = await pointsRoute.GET(
    new NextRequest(
      `http://platelets.local/api/points?source=hospitals&detail=summary&limit=2&cursor=${encodeURIComponent(
        firstPage.nextCursor ?? "",
      )}`,
    ),
  );
  const secondPage = (await secondResponse.json()) as {
    nextCursor: string | null;
    points: Array<{ name: string }>;
  };

  assert.deepEqual(
    secondPage.points.map((current) => current.name),
    ["charlie"],
  );
  assert.equal(secondPage.nextCursor, null);
});

test("logs API clamps oversized limits", async () => {
  await ensureSetup();
  const db = await pointsDb.getDatabase();
  await db.run("DELETE FROM api_logs");

  for (let index = 0; index < 505; index += 1) {
    await db.run(
      `INSERT INTO api_logs (
        event_at, level, category, source, action, status, message,
        request_count, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date(Date.UTC(2026, 5, 16, 0, 0, index)).toISOString(),
        "info",
        "system",
        null,
        "test",
        "success",
        `event-${index}`,
        0,
        "{}",
      ],
    );
  }

  const response = await logsRoute.GET(
    await sudoRequest("/api/logs?limit=10000&category=system"),
  );
  const payload = (await response.json()) as {
    logs: Array<{ message: string }>;
    nextCursor: string | null;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.logs.length, 500);
  assert.equal(typeof payload.nextCursor, "string");
});

test("listing APIs reject malformed cursors", async () => {
  const logsResponse = await logsRoute.GET(
    await sudoRequest("/api/logs?cursor=not-a-cursor"),
  );
  const pointsResponse = await pointsRoute.GET(
    new NextRequest("http://platelets.local/api/points?cursor=not-a-cursor"),
  );

  assert.equal(logsResponse.status, 400);
  assert.deepEqual(await logsResponse.json(), { errorCode: "invalid_cursor" });
  assert.equal(pointsResponse.status, 400);
  assert.deepEqual(await pointsResponse.json(), {
    errorCode: "invalid_cursor",
  });
});
