import { expect, test } from "@playwright/test";
import { ensureSetupComplete, signInAsStaff } from "./home-helpers";

test.describe.configure({ mode: "serial", timeout: 60_000 });

test("incident API records create, edit, and status history", async ({
  request,
}) => {
  await ensureSetupComplete(request);
  const denied = await request.post("/api/disaster/incidents", {
    data: {
      latitude: 37.5665,
      longitude: 126.978,
      riskLevel: "medium",
      title: "Anonymous E2E incident",
      type: "fire",
    },
  });
  expect(denied.status()).toBe(401);

  await signInAsStaff(request, "admin");
  const created = await request.post("/api/disaster/incidents", {
    data: {
      address: "서울특별시 중구 세종대로 110",
      description: "E2E 테스트용 사고입니다.",
      latitude: 37.5665,
      longitude: 126.978,
      occurredAt: new Date().toISOString(),
      riskLevel: "medium",
      title: "E2E 테스트 사고",
      type: "fire",
    },
  });
  expect(created.ok()).toBeTruthy();
  const createdPayload = (await created.json()) as {
    incident: { id: string; title: string };
  };
  const incidentId = createdPayload.incident.id;

  try {
    const edited = await request.patch(
      `/api/disaster/incidents/${incidentId}`,
      {
        data: {
          description: "수정된 E2E 테스트 사고입니다.",
          riskLevel: "high",
          title: "E2E 테스트 사고 수정",
        },
      },
    );
    expect(edited.ok()).toBeTruthy();

    const dispatched = await request.patch(
      `/api/disaster/incidents/${incidentId}`,
      { data: { status: "dispatched" } },
    );
    expect(dispatched.ok()).toBeTruthy();
    const dispatchedPayload = (await dispatched.json()) as {
      events: Array<{ type: string }>;
      incident: { status: string; title: string };
    };

    expect(dispatchedPayload.incident.title).toBe("E2E 테스트 사고 수정");
    expect(dispatchedPayload.incident.status).toBe("dispatched");
    expect(dispatchedPayload.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["created", "updated", "status"]),
    );
  } finally {
    const deleted = await request.delete(
      `/api/disaster/incidents/${incidentId}`,
    );

    expect(deleted.ok()).toBeTruthy();
  }
});

test("disaster report export returns an Excel-compatible workbook", async ({
  request,
}) => {
  await ensureSetupComplete(request);

  const response = await request.get("/api/disaster/reports?format=excel", {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain(
    "application/vnd.ms-excel",
  );
  expect(response.headers()["content-disposition"]).toContain(
    "platelets-disaster-report-",
  );

  const body = await response.text();
  expect(body).toContain('<Worksheet ss:Name="Overview">');
  expect(body).toContain('<Worksheet ss:Name="Incident history">');
  expect(body).toContain('<Worksheet ss:Name="Resource placement">');
});

test("incident updates reach an open dashboard without a reload", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await signInAsStaff(request, "sudo");
  const observer = await page.context().newPage();
  const eventStream = observer.waitForResponse(
    (response) =>
      response.url().endsWith("/api/disaster/events") &&
      response.status() === 200,
  );
  await observer.goto("/incidents", { waitUntil: "domcontentloaded" });
  await eventStream;

  const title = `E2E real-time incident ${Date.now()}`;
  const created = await request.post("/api/disaster/incidents", {
    data: {
      address: "Seoul City Hall",
      description: "SSE synchronization test",
      latitude: 37.5665,
      longitude: 126.978,
      occurredAt: new Date().toISOString(),
      riskLevel: "medium",
      title,
      type: "fire",
    },
  });
  expect(created.ok()).toBeTruthy();
  const createdPayload = (await created.json()) as {
    incident: { id: string };
  };

  try {
    await expect(observer.getByText(title, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    const deleted = await request.delete(
      `/api/disaster/incidents/${createdPayload.incident.id}`,
    );
    expect(deleted.ok()).toBeTruthy();
    await expect(observer.getByText(title, { exact: true })).toBeHidden({
      timeout: 10_000,
    });
    await observer.close();
  }
});
