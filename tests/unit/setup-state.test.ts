import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-setup-db-"));
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const setupEnvironment = await import("@/lib/setup-environment");
const setupState = await import("@/lib/setup-state");

const validPassword = "Platelets!2026";

test("deleteSetupDatabaseFile closes and removes an open incomplete database", async () => {
  await pointsDb.getDatabase();
  assert.equal(existsSync(pointsDb.getDatabaseFilePath()), true);

  await setupEnvironment.deleteSetupDatabaseFile();

  assert.equal(existsSync(pointsDb.getDatabaseFilePath()), false);
});

test("completeSetup reuses a pre-existing incomplete database", async () => {
  await pointsDb.getDatabase();

  const state = await setupState.completeSetup({
    admin: {
      email: "operator@example.com",
      fullName: "Operator",
      password: validPassword,
    },
    apiKeys: {},
    licenseAccepted: true,
    sudo: {
      email: "administrator@example.com",
      fullName: "Administrator",
      password: validPassword,
    },
  });

  assert.ok(state.completedAt);
  assert.equal(await setupState.isSetupComplete(), true);
  await pointsDb.closeDatabase();
});
