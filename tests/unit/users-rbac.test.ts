import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { UserAccount } from "@/lib/users";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-rbac-"));
process.env.PLATELETS_DATA_DIR = dataDirectory;

const pointsDb = await import("@/lib/points-db");
const setupState = await import("@/lib/setup-state");
const authSessions = await import("@/lib/auth-sessions");
const users = await import("@/lib/users");
const { incidentService } = await import(
  "@/lib/disaster-response/incident-service"
);
const adminUsersRoute = await import("@/app/api/admin/users/route");

const sudoPassword = "StrongSudoPass1!";
const adminPassword = "StrongAdminPass1!";

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

function requestWithSession(token: string) {
  return new Request("http://platelets.local/api/admin/users", {
    headers: { cookie: `${authSessions.SESSION_COOKIE_NAME}=${token}` },
  });
}

test("setup creates sudo and admin user accounts", async () => {
  await ensureSetup();
  const accounts = await users.listUsers();

  assert.equal(
    accounts.some((account) => account.username === "sudo"),
    true,
  );
  assert.equal(
    accounts.some((account) => account.username === "admin"),
    true,
  );
});

test("staff username login creates a role-aware session", async () => {
  await ensureSetup();
  const field = await users.createUser({
    department: "Jongno",
    email: "field@example.com",
    name: "Field Worker",
    password: "StrongFieldPass1!",
    phone: "010-0000-0000",
    role: "field_worker",
    username: "field.one",
  });
  const session = await authSessions.createAccessSession(
    "StrongFieldPass1!",
    "field.one",
  );

  assert.equal(session?.role, "field_worker");
  assert.equal(session?.userId, field.id);
  assert.equal(session?.name, "Field Worker");
});

test("admin users API requires an admin-capable session", async () => {
  await ensureSetup();
  const denied = await adminUsersRoute.GET(
    new Request("http://platelets.local/api/admin/users"),
  );

  assert.equal(denied.status, 401);

  const session = await authSessions.createAccessSession(
    adminPassword,
    "admin",
  );
  assert.ok(session);

  const allowed = await adminUsersRoute.GET(requestWithSession(session.token));
  const payload = (await allowed.json()) as { users: UserAccount[] };

  assert.equal(allowed.status, 200);
  assert.equal(Array.isArray(payload.users), true);
});

test("incident events record the acting staff member", async () => {
  await ensureSetup();
  const field = await users.authenticateUser("field.one", "StrongFieldPass1!");
  assert.ok(field);

  const incident = await incidentService.createIncident(
    {
      address: "서울특별시 중구 세종대로 110",
      description: "Actor audit test",
      latitude: 37.5665,
      longitude: 126.978,
      riskLevel: "medium",
      title: "Actor audit incident",
      type: "fire",
    },
    { id: field.id, name: field.name, role: field.role },
  );
  const events = await incidentService.listIncidentEvents(incident.id);
  const created = events.find((event) => event.type === "created");

  assert.equal(created?.actorName, "Field Worker");
  assert.equal(created?.actorRole, "field_worker");

  await pointsDb.closeDatabase();
});
