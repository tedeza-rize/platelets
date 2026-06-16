import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";
import { buildCapabilityEvidence } from "@/lib/emergency-capability-evidence";
import type {
  EmergencyPointInput,
  replaceDataset as ReplaceDataset,
} from "@/lib/points-db";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-unit-recommendation-"),
);
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const recommendation = await import("@/lib/emergency-recommendation");
const replaceDataset: typeof ReplaceDataset = pointsDb.replaceDataset;

function emergencyInstitution(
  patch: Partial<EmergencyPointInput> & Pick<EmergencyPointInput, "name">,
): EmergencyPointInput {
  return {
    address: `${patch.name} address`,
    category: "지역응급의료기관",
    latitude: 37.5665,
    longitude: 126.978,
    parentName: null,
    phone: "02-0000-0000",
    raw: {
      dutyEryn: "1",
      hvec: "1",
    },
    source: "emergency-medical-institutions",
    sourceRecordId: patch.name,
    sourceUpdatedAt: "202606120900",
    ...patch,
  };
}

test("recommendEmergencyHospitals ranks scenario-capable hospitals first", async () => {
  await replaceDataset({
    failedCount: 0,
    fetchedAt: "2026-06-12T00:00:00.000Z",
    geocodedCount: 3,
    points: [
      emergencyInstitution({
        category: "권역응급의료센터",
        name: "cardiac center",
        raw: {
          departments: "심장 순환기 흉부외과 심근경색 심혈관 중증",
          dutyEryn: "1",
          hvec: "6",
          hvcc: "2",
        },
      }),
      emergencyInstitution({
        latitude: 37.57,
        longitude: 126.99,
        name: "general clinic",
        raw: {
          departments: "일반 응급의학 내과",
          dutyEryn: "1",
          hvec: "2",
        },
      }),
      emergencyInstitution({
        name: "no phone hospital",
        phone: null,
        raw: {
          dutyEryn: "1",
          hvec: "10",
        },
      }),
    ],
    skippedCount: 0,
    source: "emergency-medical-institutions",
  });

  const results = await recommendation.recommendEmergencyHospitals({
    latitude: 37.5665,
    longitude: 126.978,
    scenario: "cardiac",
  });

  assert.equal(results[0].name, "cardiac center");
  assert.ok(results[0].scenarioMinimumPassed);
  assert.ok(results[0].score > results[1].score);
  assert.equal(results[0].capabilityEvidence.availability.state, "known");
  assert.equal(results[0].capabilityEvidence.freshness.state, "stale");
  assert.ok(results[0].freshnessConfidence < 1);
  assert.ok(results.every((result) => result.name !== "no phone hospital"));
});

test("capability evidence separates missing, stale, and unavailable data", () => {
  const missing = buildCapabilityEvidence({
    emergencyBeds: null,
    ratios: {
      availability: 0.45,
      bedType: 0.2,
      criticalCare: 0.1,
      specialty: 0.1,
    },
    sourceUpdatedAt: null,
  });
  const unavailable = buildCapabilityEvidence({
    emergencyBeds: 0,
    ratios: {
      availability: 0.05,
      bedType: 0.1,
      criticalCare: 0.9,
      specialty: 0.9,
    },
    sourceUpdatedAt: "202001010000",
  });

  assert.equal(missing.availability.state, "unknown");
  assert.equal(missing.freshness.state, "unknown");
  assert.equal(unavailable.availability.state, "unavailable");
  assert.equal(unavailable.bedType.state, "unavailable");
  assert.equal(unavailable.criticalCare.state, "known");
  assert.equal(unavailable.freshness.state, "stale");
});
