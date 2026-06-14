import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDisasterReportWorkbook,
  escapeSpreadsheetXml,
} from "@/lib/disaster-response/report-export";
import type {
  Incident,
  IncidentEvent,
  ResourceRecommendation,
} from "@/lib/disaster-response/types";
import { getDictionary } from "@/lib/i18n";

const generatedAt = new Date("2026-06-13T01:02:03.000Z");

const incident: Incident = {
  address: "Seoul & Central <HQ>",
  createdAt: "2026-06-13T00:00:00.000Z",
  description: "Smoke reported near the main entrance",
  id: "inc-report-test",
  latitude: 37.5665,
  longitude: 126.978,
  occurredAt: "2026-06-13T00:00:00.000Z",
  riskLevel: "high",
  status: "reported",
  title: "=SUM(1,1)",
  type: "fire",
};

const incidentEvent: IncidentEvent = {
  actorId: null,
  actorName: null,
  actorRole: null,
  createdAt: "2026-06-13T00:01:00.000Z",
  fromStatus: null,
  id: "event-report-test",
  incidentId: incident.id,
  message: "Incident created",
  toStatus: "reported",
  type: "created",
};

const resourceRecommendation: ResourceRecommendation = {
  areaId: "risk-a",
  areaName: "Central district",
  id: "resource-risk-a",
  message: "Pre-position response teams",
  priority: "high",
  reasons: ["High risk score", "Recent incident"],
  recommendedAmbulances: 2,
  recommendedFireEngines: 3,
  recommendedRescueTrucks: 1,
  riskScore: 92,
  timeWindow: "14:00-18:00",
};

const snapshot = {
  activeIncident: incident,
  bigData119OperationalSummaries: [],
  bigData119Points: [],
  bigData119Summaries: [],
  dispatchRecommendation: null,
  fireStations: [],
  hospitalRecommendations: [],
  hospitals: [],
  incidents: [incident],
  resourceRecommendations: [resourceRecommendation],
  riskAreas: [
    {
      baseScore: 70,
      factors: ["Recent incident"],
      id: "risk-a",
      latitude: 37.5665,
      longitude: 126.978,
      name: "Central district",
      recentIncidentCount: 1,
      riskLevel: "high",
      riskScore: 92,
    },
  ],
} satisfies NonNullable<
  Parameters<typeof buildDisasterReportWorkbook>[0]["snapshot"]
>;

test("spreadsheet XML escapes unsafe text", () => {
  assert.equal(
    escapeSpreadsheetXml(`A&B <C> "D" 'E'`),
    "A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;",
  );
});

test("disaster report workbook includes incident history and resources", async () => {
  const workbook = await buildDisasterReportWorkbook({
    dictionary: getDictionary("en"),
    eventsByIncident: new Map([[incident.id, [incidentEvent]]]),
    generatedAt,
    snapshot,
  });

  assert.equal(workbook.contentType, "application/vnd.ms-excel; charset=utf-8");
  assert.equal(
    workbook.filename,
    "platelets-disaster-report-20260613010203.xls",
  );
  assert.match(workbook.body, /<Worksheet ss:Name="Overview">/);
  assert.match(workbook.body, /<Worksheet ss:Name="Incident history">/);
  assert.match(workbook.body, /<Worksheet ss:Name="Resource placement">/);
  assert.match(workbook.body, /Seoul &amp; Central &lt;HQ&gt;/);
  assert.match(workbook.body, /&apos;=SUM\(1,1\)/);
  assert.match(workbook.body, /Pre-position response teams/);
});
