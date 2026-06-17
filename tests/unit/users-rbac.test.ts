import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";
import type { UserAccount } from "@/lib/users";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-rbac-"));
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const setupState = await import("@/lib/setup-state");
const authSessions = await import("@/lib/auth-sessions");
const users = await import("@/lib/users");
const { incidentService } = await import(
  "@/lib/disaster-response/incident-service"
);
const adminUsersRoute = await import("@/app/api/admin/users/route");
const adminUserRoute = await import("@/app/api/admin/users/[id]/route");
const incidentRoute = await import("@/app/api/disaster/incidents/[id]/route");

test.after(async () => {
  await pointsDb.closeDatabase();
});

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

function requestWithSession(
  token: string,
  input: { body?: unknown; method?: string; path?: string } = {},
) {
  return new Request(
    `http://platelets.local${input.path ?? "/api/admin/users"}`,
    {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      headers: {
        "content-type": "application/json",
        cookie: `${authSessions.SESSION_COOKIE_NAME}=${token}`,
      },
      method: input.method,
    },
  );
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
  const [field, _error] = await users.createUser({
    department: "Jongno",
    email: "field@example.com",
    name: "Field Worker",
    password: "StrongFieldPass1!",
    phone: "010-0000-0000",
    role: "field_worker",
    username: "field.one",
  });
  assert.ok(field);
  const session = await authSessions.createAccessSession(
    "StrongFieldPass1!",
    "field.one",
  );

  assert.equal(session?.role, "field_worker");
  assert.equal(session?.userId, field.id);
  assert.equal(session?.name, "Field Worker");
});

test("username login cannot fall back to setup passwords", async () => {
  await ensureSetup();

  const session = await authSessions.createAccessSession(
    adminPassword,
    "missing-user",
  );

  assert.equal(session, null);
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

test("incident mutation routes require and record a staff session", async () => {
  await ensureSetup();
  const denied = await incidentRoute.PATCH(
    new Request("http://platelets.local/api/disaster/incidents/missing", {
      body: JSON.stringify({ status: "closed" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    }),
    { params: Promise.resolve({ id: "missing" }) },
  );
  assert.equal(denied.status, 401);

  const field = await users.authenticateUser("field.one", "StrongFieldPass1!");
  const session = await authSessions.createAccessSession(
    "StrongFieldPass1!",
    "field.one",
  );
  assert.ok(field);
  assert.ok(session);

  const incident = await incidentService.createIncident(
    {
      address: "서울특별시 중구 세종대로 110",
      description: "Authenticated route test",
      latitude: 37.5665,
      longitude: 126.978,
      riskLevel: "medium",
      title: "Authenticated incident",
      type: "fire",
    },
    { id: field.id, name: field.name, role: field.role },
  );
  const updated = await incidentRoute.PATCH(
    requestWithSession(session.token, {
      body: { status: "dispatched" },
      method: "PATCH",
      path: `/api/disaster/incidents/${incident.id}`,
    }),
    { params: Promise.resolve({ id: incident.id }) },
  );
  assert.equal(updated.status, 200);

  const events = await incidentService.listIncidentEvents(incident.id);
  const statusEvent = events.find((event) => event.type === "status");
  assert.equal(statusEvent?.actorName, "Field Worker");

  const deleted = await incidentRoute.DELETE(
    requestWithSession(session.token, {
      method: "DELETE",
      path: `/api/disaster/incidents/${incident.id}`,
    }),
    { params: Promise.resolve({ id: incident.id }) },
  );
  assert.equal(deleted.status, 200);
  assert.equal(await incidentService.getIncident(incident.id), null);
  assert.equal(
    (await incidentService.listIncidentEvents(incident.id)).some(
      (event) => event.type === "deleted",
    ),
    true,
  );
});

test("account deletion protects the current and sudo accounts", async () => {
  await ensureSetup();
  const admin = await users.authenticateUser("admin", adminPassword);
  const sudo = await users.authenticateUser("sudo", sudoPassword);
  assert.ok(admin);
  assert.ok(sudo);

  const adminSession = await authSessions.createAccessSession(
    adminPassword,
    "admin",
  );
  assert.ok(adminSession);

  const selfDelete = await adminUserRoute.DELETE(
    requestWithSession(adminSession.token, { method: "DELETE" }),
    { params: Promise.resolve({ id: admin.id }) },
  );
  assert.equal(selfDelete.status, 409);
  assert.deepEqual(await selfDelete.json(), { errorCode: "self_delete" });

  const sudoDelete = await adminUserRoute.DELETE(
    requestWithSession(adminSession.token, { method: "DELETE" }),
    { params: Promise.resolve({ id: sudo.id }) },
  );
  assert.equal(sudoDelete.status, 403);
  assert.deepEqual(await sudoDelete.json(), { errorCode: "sudo_required" });

  const sudoSession = await authSessions.createAccessSession(
    sudoPassword,
    "sudo",
  );
  assert.ok(sudoSession);
  const protectedDelete = await adminUserRoute.DELETE(
    requestWithSession(sudoSession.token, { method: "DELETE" }),
    { params: Promise.resolve({ id: sudo.id }) },
  );
  assert.equal(protectedDelete.status, 409);
  assert.deepEqual(await protectedDelete.json(), {
    errorCode: "self_delete",
  });
});

test("role and password updates revoke the target user's sessions", async () => {
  await ensureSetup();
  const [target, _error] = await users.createUser({
    department: "Mapo",
    email: "session-target@example.com",
    name: "Session Target",
    password: "StrongTargetPass1!",
    phone: "",
    role: "field_worker",
    username: "session.target",
  });
  assert.ok(target);
  const targetSession = await authSessions.createAccessSession(
    "StrongTargetPass1!",
    target.username,
  );
  const adminSession = await authSessions.createAccessSession(
    adminPassword,
    "admin",
  );
  assert.ok(targetSession);
  assert.ok(adminSession);

  const updated = await adminUserRoute.PATCH(
    requestWithSession(adminSession.token, {
      body: {
        password: "UpdatedTargetPass1!",
        role: "dispatcher",
      },
      method: "PATCH",
      path: `/api/admin/users/${target.id}`,
    }),
    { params: Promise.resolve({ id: target.id }) },
  );
  assert.equal(updated.status, 200);
  assert.equal(await authSessions.getAccessSession(targetSession.token), null);

  const relogin = await authSessions.createAccessSession(
    "UpdatedTargetPass1!",
    target.username,
  );
  assert.equal(relogin?.role, "dispatcher");
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
});
