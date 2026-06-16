import {
  calculateEmergencyRoute,
  hasKakaoMobilityKey,
  haversineMeters,
} from "@/lib/emergency-routing";
import {
  findNearestEmergencyInstitutions,
  findNearestPoints,
} from "@/lib/points-db";

export type EmergencyScenario =
  | "general"
  | "pediatric-respiratory"
  | "cardiac"
  | "stroke"
  | "trauma"
  | "burn"
  | "delivery"
  | "elderly-fall";

type ScoreCategory =
  | "travelTime"
  | "specialty"
  | "bedType"
  | "criticalCare"
  | "availability"
  | "gradeStability";

type ScoreWeights = Record<ScoreCategory, number>;
type EmergencyInstitutionCandidate = Awaited<
  ReturnType<typeof findNearestEmergencyInstitutions>
>[number];

const LIVE_ETA_CANDIDATE_LIMIT = 5;
const RECOMMENDATION_TIMEOUT_MS = 8_000;

function emergencyBedRatios(
  emergencyBeds: number | null,
  fallbackBedRatio: number,
) {
  if (emergencyBeds === null) {
    return { availabilityRatio: 0.45, bedRatio: fallbackBedRatio };
  }

  if (emergencyBeds > 0) {
    return {
      availabilityRatio: Math.min(1, 0.65 + emergencyBeds / 20),
      bedRatio: 1,
    };
  }

  return { availabilityRatio: 0.05, bedRatio: 0.1 };
}

function emergencyBedReason(emergencyBeds: number | null) {
  if (emergencyBeds === null) {
    return "응급실 병상 정보 미확인";
  }

  return emergencyBeds > 0
    ? `응급실 가용병상 ${emergencyBeds}개`
    : "응급실 가용병상 없음";
}

const WEIGHTS: Record<EmergencyScenario, ScoreWeights> = {
  general: {
    availability: 20,
    bedType: 10,
    criticalCare: 0,
    gradeStability: 10,
    specialty: 10,
    travelTime: 50,
  },
  "pediatric-respiratory": {
    availability: 10,
    bedType: 25,
    criticalCare: 15,
    gradeStability: 0,
    specialty: 25,
    travelTime: 25,
  },
  cardiac: {
    availability: 10,
    bedType: 15,
    criticalCare: 15,
    gradeStability: 0,
    specialty: 30,
    travelTime: 30,
  },
  stroke: {
    availability: 10,
    bedType: 15,
    criticalCare: 20,
    gradeStability: 0,
    specialty: 30,
    travelTime: 25,
  },
  trauma: {
    availability: 10,
    bedType: 20,
    criticalCare: 20,
    gradeStability: 0,
    specialty: 25,
    travelTime: 25,
  },
  burn: {
    availability: 10,
    bedType: 20,
    criticalCare: 15,
    gradeStability: 0,
    specialty: 30,
    travelTime: 25,
  },
  delivery: {
    availability: 10,
    bedType: 25,
    criticalCare: 10,
    gradeStability: 0,
    specialty: 30,
    travelTime: 25,
  },
  "elderly-fall": {
    availability: 10,
    bedType: 15,
    criticalCare: 10,
    gradeStability: 5,
    specialty: 25,
    travelTime: 35,
  },
};

const STRICT_SCENARIOS = new Set<EmergencyScenario>([
  "pediatric-respiratory",
  "cardiac",
  "stroke",
  "trauma",
  "burn",
  "delivery",
]);

const CAPABILITY_TERMS: Record<
  Exclude<ScoreCategory, "travelTime" | "availability" | "gradeStability">,
  Record<EmergencyScenario, string[]>
> = {
  bedType: {
    burn: ["중환자", "수술", "화상", "hvcc", "hvoc"],
    cardiac: ["중환자", "흉부", "심혈관", "hvcc", "hvccc"],
    delivery: ["분만", "신생아", "인큐베이터", "hv3", "hvncc"],
    "elderly-fall": ["일반병상", "중환자", "수술", "hvgc", "hvoc"],
    general: ["응급실", "일반병상", "hvec", "hvgc"],
    "pediatric-respiratory": ["소아", "신생아", "중환자", "hvncc", "hvcc"],
    stroke: ["중환자", "신경", "수술", "hvicc", "hvoc"],
    trauma: ["외상", "중환자", "수술", "hvcc", "hvoc"],
  },
  criticalCare: {
    burn: ["화상", "중증", "수술"],
    cardiac: ["심근경색", "심혈관", "흉통", "중증"],
    delivery: ["응급분만", "신생아", "미숙아"],
    "elderly-fall": ["골절", "신경외과", "중증"],
    general: ["응급", "중증"],
    "pediatric-respiratory": ["소아", "호흡", "인공호흡", "중증"],
    stroke: ["뇌경색", "뇌출혈", "재관류", "중증"],
    trauma: ["외상", "사지접합", "수술", "중증"],
  },
  specialty: {
    burn: ["화상", "외과", "성형외과"],
    cardiac: ["심장", "순환기", "흉부외과", "내과"],
    delivery: ["산부인과", "분만", "신생아"],
    "elderly-fall": ["정형외과", "신경외과", "내과"],
    general: ["응급의학", "내과", "외과"],
    "pediatric-respiratory": ["소아청소년과", "소아", "호흡기"],
    stroke: ["신경과", "신경외과", "뇌혈관"],
    trauma: ["외상", "외과", "정형외과", "신경외과"],
  },
};

function numeric(raw: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function rawSearchText(raw: Record<string, string>) {
  return Object.entries(raw)
    .filter(([key, value]) => value && !key.toLowerCase().includes("addr"))
    .map(([key, value]) => `${key} ${value}`)
    .join(" ")
    .toLowerCase();
}

function termRatio(text: string, terms: string[]) {
  if (terms.length === 0) {
    return 0.5;
  }

  const matches = terms.filter((term) =>
    text.includes(term.toLowerCase()),
  ).length;
  return Math.min(1, 0.2 + matches / Math.min(3, terms.length));
}

function freshnessRatio(value: string | null) {
  if (!value) {
    return 0.35;
  }

  const compact = value.replace(/[^0-9]/g, "");
  const parsed =
    compact.length >= 12
      ? Date.parse(
          `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(8, 10)}:${compact.slice(10, 12)}:00+09:00`,
        )
      : Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return 0.35;
  }

  const ageMinutes = Math.max(0, (Date.now() - parsed) / 60_000);
  return Math.max(0.15, 1 - ageMinutes / (24 * 60));
}

function gradeRatio(category: string) {
  if (/권역|전문/.test(category)) return 1;
  if (/지역응급의료센터/.test(category)) return 0.85;
  if (/지역응급의료기관/.test(category)) return 0.65;
  return 0.45;
}

function isEmergencyOperating(candidate: {
  category: string;
  raw: Record<string, string>;
}) {
  return (
    candidate.raw.dutyEryn === "1" ||
    /응급|권역|지역응급|센터/.test(candidate.category) ||
    /응급실|응급의료/.test(rawSearchText(candidate.raw))
  );
}

function passesScenarioMinimum(params: {
  availabilityRatio: number;
  bedRatio: number;
  candidate: { category: string; raw: Record<string, string> };
  criticalCareRatio: number;
  emergencyBeds: number | null;
  scenario: EmergencyScenario;
  specialtyRatio: number;
}) {
  if (!isEmergencyOperating(params.candidate)) {
    return {
      passed: false,
      reason: "응급실 운영 여부를 확인할 수 없음",
    };
  }

  if (params.emergencyBeds !== null && params.emergencyBeds <= 0) {
    return {
      passed: false,
      reason: "응급실 가용병상 없음",
    };
  }

  if (!STRICT_SCENARIOS.has(params.scenario)) {
    return {
      passed: true,
      reason: "기본 응급 진료 최소 조건 통과",
    };
  }

  const highGradeEmergencyCenter =
    gradeRatio(params.candidate.category) >= 0.65;
  const specialtyMatch = params.specialtyRatio >= 0.5;
  const bedMatch = params.bedRatio >= 0.5 || params.availabilityRatio >= 0.65;
  const criticalMatch = params.criticalCareRatio >= 0.4;

  if (params.scenario === "pediatric-respiratory") {
    const passed =
      (specialtyMatch || bedMatch || highGradeEmergencyCenter) &&
      (bedMatch || criticalMatch || highGradeEmergencyCenter);

    return {
      passed,
      reason: passed
        ? "소아·호흡곤란 최소 수용 조건 통과"
        : "소아·호흡곤란 대응 근거 부족",
    };
  }

  const passed =
    specialtyMatch ||
    criticalMatch ||
    (highGradeEmergencyCenter && params.availabilityRatio >= 0.45);

  return {
    passed,
    reason: passed
      ? "상황별 중증 수용 최소 조건 통과"
      : "상황별 진료역량 근거 부족",
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const current = index;
      index += 1;
      output[current] = await mapper(values[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return output;
}

function estimatedEta(
  candidate: EmergencyInstitutionCandidate,
  origin: { latitude: number; longitude: number },
) {
  const roadDistance = Math.max(
    candidate.distanceMeters * 1.25,
    haversineMeters(origin, candidate),
  );

  return {
    candidate,
    distanceMeters: Math.round(roadDistance),
    durationSeconds: Math.round(roadDistance / 11.1),
    etaSource: "estimated" as const,
  };
}

function candidateEtaPriority(
  candidate: EmergencyInstitutionCandidate,
  scenario: EmergencyScenario,
) {
  const text = rawSearchText(candidate.raw);
  const emergencyBeds = numeric(candidate.raw, ["realtimeBed.hvec", "hvec"]);
  const emergencyBedScore =
    emergencyBeds === null ? 0.35 : Math.min(1, Math.max(0, emergencyBeds / 8));
  const capabilityScore =
    termRatio(text, CAPABILITY_TERMS.specialty[scenario]) * 0.45 +
    termRatio(text, CAPABILITY_TERMS.criticalCare[scenario]) * 0.35 +
    emergencyBedScore * 0.2;

  return (
    capabilityScore * 100 +
    gradeRatio(candidate.category) * 20 -
    Math.min(candidate.distanceMeters / 1000, 120)
  );
}

async function withRecommendationTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("recommendation_timeout")),
      RECOMMENDATION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function recommendEmergencyHospitals(params: {
  latitude: number;
  longitude: number;
  scenario: EmergencyScenario;
}) {
  const origin = { latitude: params.latitude, longitude: params.longitude };
  const candidates = await findNearestEmergencyInstitutions({
    ...origin,
    limit: 12,
    radiusMeters: 120_000,
  });
  const useKakaoEta = await hasKakaoMobilityKey();
  const rankedCandidates = candidates
    .filter((candidate) => Boolean(candidate.phone))
    .sort(
      (left, right) =>
        candidateEtaPriority(right, params.scenario) -
        candidateEtaPriority(left, params.scenario),
    );
  const liveEtaIds = new Set(
    rankedCandidates
      .slice(0, LIVE_ETA_CANDIDATE_LIMIT)
      .map((candidate) => candidate.id),
  );
  const etaWork = mapWithConcurrency(rankedCandidates, 3, async (candidate) => {
    if (useKakaoEta) {
      try {
        if (liveEtaIds.has(candidate.id)) {
          const route = await calculateEmergencyRoute({
            destination: {
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            },
            origin,
            provider: "kakao",
          });
          return {
            candidate,
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
            etaSource: "kakao" as const,
          };
        }
      } catch {
        // One failed route must not discard the remaining hospitals.
      }
    }

    return estimatedEta(candidate, origin);
  });
  const withEta = await withRecommendationTimeout(etaWork).catch(() =>
    rankedCandidates.map((candidate) => estimatedEta(candidate, origin)),
  );
  const weights = WEIGHTS[params.scenario];

  return withEta
    .map(({ candidate, distanceMeters, durationSeconds, etaSource }) => {
      const text = rawSearchText(candidate.raw);
      const emergencyBeds = numeric(candidate.raw, [
        "realtimeBed.hvec",
        "hvec",
      ]);
      const { availabilityRatio, bedRatio } = emergencyBedRatios(
        emergencyBeds,
        termRatio(text, CAPABILITY_TERMS.bedType[params.scenario]),
      );
      const travelMinutes = durationSeconds / 60;
      const ratios: Record<ScoreCategory, number> = {
        availability: availabilityRatio,
        bedType: bedRatio,
        criticalCare: termRatio(
          text,
          CAPABILITY_TERMS.criticalCare[params.scenario],
        ),
        gradeStability:
          (gradeRatio(candidate.category) +
            freshnessRatio(candidate.sourceUpdatedAt)) /
          2,
        specialty: termRatio(text, CAPABILITY_TERMS.specialty[params.scenario]),
        travelTime: Math.max(0.05, 1 - travelMinutes / 90),
      };
      const minimum = passesScenarioMinimum({
        availabilityRatio,
        bedRatio,
        candidate,
        criticalCareRatio: ratios.criticalCare,
        emergencyBeds,
        scenario: params.scenario,
        specialtyRatio: ratios.specialty,
      });
      const scoreBreakdown = Object.fromEntries(
        Object.entries(weights).map(([key, weight]) => [
          key,
          Math.round(weight * ratios[key as ScoreCategory] * 10) / 10,
        ]),
      ) as Record<ScoreCategory, number>;
      const score =
        Math.round(
          Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0) *
            10,
        ) / 10;
      const reasons = [
        `${Math.max(1, Math.round(travelMinutes))}분 예상`,
        emergencyBedReason(emergencyBeds),
        minimum.reason,
      ];

      if (ratios.specialty >= 0.7 && params.scenario !== "general") {
        reasons.push("상황 관련 진료역량 확인");
      }
      if (etaSource === "estimated") {
        reasons.push("도로 ETA 추정값");
      }

      return {
        address: candidate.address,
        category: candidate.category,
        distanceMeters,
        durationSeconds,
        etaSource,
        id: candidate.id,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        name: candidate.name,
        phone: candidate.phone,
        reasons,
        score,
        scoreBreakdown,
        scenarioMinimumPassed: minimum.passed,
        sourceUpdatedAt: candidate.sourceUpdatedAt,
      };
    })
    .filter((hospital) => hospital.scenarioMinimumPassed)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.durationSeconds - right.durationSeconds,
    )
    .slice(0, 8);
}

export async function findEmergencyDispatchStation(params: {
  latitude: number;
  longitude: number;
}) {
  const [station] = await findNearestPoints({
    ...params,
    limit: 1,
    radiusMeters: 80_000,
    source: "fire-stations",
  });

  return station ?? null;
}
