export type CapabilityState = "known" | "stale" | "unavailable" | "unknown";

export type RecommendationCapabilityEvidence = {
  availability: {
    emergencyBeds: number | null;
    ratio: number;
    state: CapabilityState;
  };
  bedType: { ratio: number; state: CapabilityState };
  criticalCare: { ratio: number; state: CapabilityState };
  freshness: {
    confidence: number;
    sourceUpdatedAt: string | null;
    state: CapabilityState;
  };
  specialty: { ratio: number; state: CapabilityState };
};

type CapabilityRatios = {
  availability: number;
  bedType: number;
  criticalCare: number;
  specialty: number;
};

function parsedSourceTime(value: string | null) {
  if (!value) return null;

  const compact = value.replace(/[^0-9]/g, "");
  const parsed =
    compact.length >= 12
      ? Date.parse(
          `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T${compact.slice(8, 10)}:${compact.slice(10, 12)}:00+09:00`,
        )
      : Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function ratioState(ratio: number) {
  return ratio >= 0.5 ? "known" : "unknown";
}

function bedState(emergencyBeds: number | null, ratio: number) {
  if (emergencyBeds === null) return ratioState(ratio);
  return emergencyBeds > 0 ? "known" : "unavailable";
}

export function freshnessEvidence(value: string | null) {
  const parsed = parsedSourceTime(value);

  if (parsed === null) {
    return {
      confidence: 0.35,
      sourceUpdatedAt: value,
      state: "unknown" as const,
    };
  }

  const ageMinutes = Math.max(0, (Date.now() - parsed) / 60_000);
  const confidence = Math.max(0.15, 1 - ageMinutes / (24 * 60));

  return {
    confidence,
    sourceUpdatedAt: value,
    state: ageMinutes > 24 * 60 ? ("stale" as const) : ("known" as const),
  };
}

export function buildCapabilityEvidence(params: {
  emergencyBeds: number | null;
  ratios: CapabilityRatios;
  sourceUpdatedAt: string | null;
}): RecommendationCapabilityEvidence {
  return {
    availability: {
      emergencyBeds: params.emergencyBeds,
      ratio: params.ratios.availability,
      state: bedState(params.emergencyBeds, params.ratios.availability),
    },
    bedType: {
      ratio: params.ratios.bedType,
      state: bedState(params.emergencyBeds, params.ratios.bedType),
    },
    criticalCare: {
      ratio: params.ratios.criticalCare,
      state: ratioState(params.ratios.criticalCare),
    },
    freshness: freshnessEvidence(params.sourceUpdatedAt),
    specialty: {
      ratio: params.ratios.specialty,
      state: ratioState(params.ratios.specialty),
    },
  };
}
