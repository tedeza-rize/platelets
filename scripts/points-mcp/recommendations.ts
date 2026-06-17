import { POINT_COLUMNS } from "./constants.ts";
import { all, withDatabase } from "./database.ts";
import { isKakaoDirectionSummary, kakaoDirectionSummary } from "./geocoding.ts";
import {
  clamp,
  distanceMeters,
  pointWithRawFromRow,
  toRadians,
} from "./points.ts";
import type {
  EmergencyCandidate,
  EmergencyHospitalRecommendation,
  EmergencyScenario,
  PointWithRawRow,
} from "./types.ts";
import {
  emergencyBedAvailability,
  STRICT_EMERGENCY_SCENARIOS,
} from "./types.ts";

function gradeRatio(category: string) {
  if (/권역|전문/.test(category)) return 1;
  if (/지역응급의료센터/.test(category)) return 0.85;
  if (/지역응급의료기관/.test(category)) return 0.65;
  return 0.45;
}

function rawSearchText(raw: Record<string, string>) {
  return Object.entries(raw)
    .filter(([key, value]) => value && !key.toLowerCase().includes("addr"))
    .map(([key, value]) => `${key} ${value}`)
    .join(" ")
    .toLowerCase();
}

function termRatio(text: string, terms: string[]) {
  if (terms.length === 0) return 0.5;
  const matches = terms.filter((term) =>
    text.includes(term.toLowerCase()),
  ).length;
  return Math.min(1, 0.2 + matches / Math.min(3, terms.length));
}

function numeric(raw: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function isEmergencyOperating(candidate: {
  category: string;
  raw: Record<string, string>;
}) {
  const text = rawSearchText(candidate.raw);

  return (
    candidate.raw.dutyEryn === "1" ||
    /응급|권역|지역응급|센터/.test(candidate.category) ||
    /응급실|응급의료/.test(text)
  );
}

function passesEmergencyScenarioMinimum(params: {
  availability: number;
  candidate: { category: string; raw: Record<string, string> };
  capability: number;
  emergencyBeds: number | null;
  scenario: EmergencyScenario;
}) {
  if (!isEmergencyOperating(params.candidate)) {
    return {
      passed: false,
      reason: "emergency-operation-not-confirmed",
    };
  }

  if (params.emergencyBeds !== null && params.emergencyBeds <= 0) {
    return {
      passed: false,
      reason: "no-emergency-bed-available",
    };
  }

  if (!STRICT_EMERGENCY_SCENARIOS.has(params.scenario)) {
    return {
      passed: true,
      reason: "basic-emergency-minimum-passed",
    };
  }

  const highGradeEmergencyCenter =
    gradeRatio(params.candidate.category) >= 0.65;
  const passed =
    params.capability >= 0.5 ||
    (highGradeEmergencyCenter && params.availability >= 0.45);

  return {
    passed,
    reason: passed
      ? "scenario-minimum-passed"
      : "scenario-capability-not-confirmed",
  };
}

const EMERGENCY_SCENARIO_TERMS: Record<EmergencyScenario, string[]> = {
  burn: ["화상", "외과", "성형외과", "중환자", "수술"],
  cardiac: ["심장", "순환기", "흉부외과", "심근경색", "중환자"],
  delivery: ["산부인과", "분만", "신생아", "응급분만"],
  "elderly-fall": ["정형외과", "신경외과", "내과", "골절"],
  general: ["응급의학", "응급실", "내과", "외과"],
  "pediatric-respiratory": ["소아청소년과", "소아", "호흡", "신생아", "중환자"],
  stroke: ["신경과", "신경외과", "뇌혈관", "뇌경색", "뇌출혈"],
  trauma: ["외상", "외과", "정형외과", "신경외과", "중환자", "수술"],
};

async function nearestEmergencyCandidates(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radiusMeters = Math.min(
    Math.max(options.radiusMeters ?? 120_000, 1_000),
    200_000,
  );
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos(toRadians(options.latitude)), 0.1));

  return withDatabase(async (db) => {
    const rows = await all<PointWithRawRow>(
      db,
      `SELECT ${POINT_COLUMNS}, p.raw_json
        FROM points p
        LEFT JOIN dataset_updates u ON u.source = p.source
        WHERE p.source = 'emergency-medical-institutions'
          AND p.latitude BETWEEN ? AND ?
          AND p.longitude BETWEEN ? AND ?
        ORDER BY ((p.latitude - ?) * (p.latitude - ?) + (p.longitude - ?) * (p.longitude - ?)), p.id
        LIMIT ?`,
      [
        options.latitude - latitudeDelta,
        options.latitude + latitudeDelta,
        options.longitude - longitudeDelta,
        options.longitude + longitudeDelta,
        options.latitude,
        options.latitude,
        options.longitude,
        options.longitude,
        5_000,
      ],
    );

    return rows
      .map(pointWithRawFromRow)
      .filter(
        (point): point is EmergencyCandidate =>
          point.latitude !== null && point.longitude !== null,
      )
      .map((point) => ({
        ...point,
        distanceMeters: Math.round(
          distanceMeters(options, {
            latitude: point.latitude,
            longitude: point.longitude,
          }),
        ),
      }))
      .filter((point) => point.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, clamp(options.limit ?? 12, 1, 50));
  });
}

export async function recommendEmergencyHospitalsForMcp(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
  scenario: EmergencyScenario;
  useDirections?: boolean;
}) {
  const origin = { latitude: options.latitude, longitude: options.longitude };
  const candidates = await nearestEmergencyCandidates({
    ...origin,
    limit: Math.max((options.limit ?? 8) * 3, 12),
    radiusMeters: options.radiusMeters,
  });
  const results: EmergencyHospitalRecommendation[] = [];

  for (const candidate of candidates.slice(0, 12)) {
    const route =
      options.useDirections === false
        ? null
        : await kakaoDirectionSummary(
            origin,
            {
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            },
            "TIME",
          );
    const durationSeconds = isKakaoDirectionSummary(route)
      ? route.durationSeconds
      : Math.round((candidate.distanceMeters * 1.25) / 11.1);
    const emergencyBeds = numeric(candidate.raw, ["realtimeBed.hvec", "hvec"]);
    const capability = termRatio(
      rawSearchText(candidate.raw),
      EMERGENCY_SCENARIO_TERMS[options.scenario],
    );
    const availability = emergencyBedAvailability(emergencyBeds);
    const minimum = passesEmergencyScenarioMinimum({
      availability,
      candidate,
      capability,
      emergencyBeds,
      scenario: options.scenario,
    });

    if (!minimum.passed) {
      continue;
    }

    const travel = Math.max(0.05, 1 - durationSeconds / 60 / 90);
    const score =
      Math.round(
        (travel * 45 +
          capability * 25 +
          availability * 20 +
          gradeRatio(candidate.category) * 10) *
          10,
      ) / 10;

    results.push({
      address: candidate.address,
      category: candidate.category,
      distanceMeters: isKakaoDirectionSummary(route)
        ? route.distanceMeters
        : Math.round(candidate.distanceMeters * 1.25),
      durationSeconds,
      emergencyBeds,
      id: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      route,
      score,
      scoreBasis: isKakaoDirectionSummary(route)
        ? "kakao-route-duration-and-medical-suitability"
        : "estimated-road-time-and-medical-suitability",
      scenarioMinimum: minimum.reason,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
    });
  }

  return results
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.durationSeconds - right.durationSeconds,
    )
    .slice(0, clamp(options.limit ?? 8, 1, 12));
}
