import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

setDataDirectoryPathForTests(
  mkdtempSync(path.join(tmpdir(), "platelets-setup-database-")),
);

const { POST } = await import("@/app/api/setup/test-database/route");
const pointsDb = await import("@/lib/points-db");

function setupDatabaseRequest(body: unknown) {
  return new Request("http://platelets.local/api/setup/test-database", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

test("setup database validation accepts SQLite", async () => {
  const response = await POST(
    setupDatabaseRequest({
      database: { connectionString: "", engine: "sqlite" },
    }),
  );
  const payload = (await response.json()) as { ok?: boolean };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);

  await pointsDb.closeDatabase();
});

test("setup database validation rejects invalid external URLs without leaking credentials", async () => {
  const password = ["sample", "credential"].join("-");
  const response = await POST(
    setupDatabaseRequest({
      database: {
        connectionString: `postgresql://admin:${password}@/platelets`,
        engine: "postgresql",
      },
    }),
  );
  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.match(responseText, /database\.failed/);
  assert.doesNotMatch(responseText, new RegExp(password, "u"));
});
