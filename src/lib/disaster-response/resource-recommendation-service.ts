import type {
  ResourceRecommendation,
  RiskArea,
} from "@/lib/disaster-response/types";

function numberFromFactor(factors: string[], pattern: RegExp) {
  const match = factors
    .map((factor) => pattern.exec(factor))
    .find((result): result is RegExpExecArray => result !== null);

  if (!match?.[1]) {
    return 0;
  }

  return Number(match[1].replace(/,/g, "")) || 0;
}

function includesFactor(factors: string[], keyword: string) {
  return factors.some((factor) => factor.includes(keyword));
}

export class ResourceRecommendationService {
  buildRecommendations(riskAreas: RiskArea[]): ResourceRecommendation[] {
    return riskAreas
      .filter((area) => area.riskLevel !== "low")
      .map((area) => {
        const highRisk = area.riskLevel === "high";
        const recentIncidents = area.recentIncidentCount;
        const fireSafetyTargets = numberFromFactor(
          area.factors,
          /특정소방대상물 ([\d,]+)건/,
        );
        const operationalLoad = numberFromFactor(
          area.factors,
          /119 신고·출동 샘플 ([\d,]+)건/,
        );
        const waterMissing = includesFactor(
          area.factors,
          "소방용수 데이터 없음",
        );
        const rescueLoad =
          includesFactor(area.factors, "부산 구조출동") ||
          includesFactor(area.factors, "교통량") ||
          includesFactor(area.factors, "교통 결절점");
        const recommendedFireEngines = Math.min(
          4,
          (highRisk ? 2 : 1) +
            (area.riskScore >= 90 ? 1 : 0) +
            (waterMissing || fireSafetyTargets >= 5 ? 1 : 0),
        );
        const recommendedAmbulances = Math.min(
          3,
          (highRisk ? 2 : 1) +
            (recentIncidents >= 2 ? 1 : 0) +
            (operationalLoad >= 8 ? 1 : 0),
        );
        const recommendedRescueTrucks = Math.min(
          2,
          (rescueLoad ? 1 : 0) + (area.riskScore >= 90 ? 1 : 0),
        );
        const timeWindow = highRisk ? "금일 14:00-18:00" : "금일 18:00-22:00";
        const derivedReasons = [
          `위험도 ${area.riskScore}점`,
          recentIncidents > 0
            ? `최근 사고 ${recentIncidents}건으로 현장 대응 여력 확보 필요`
            : "최근 사고는 없지만 예방 배치 권장",
          operationalLoad > 0
            ? `119 신고·출동 운영 부하 ${operationalLoad.toLocaleString("ko-KR")}건 반영`
            : "119 신고·출동 지역 매칭 없음",
          waterMissing
            ? "소방용수 위치 데이터 부족으로 초기 화재 대응 장비 보강"
            : "소방용수 위치 데이터 확인",
        ];

        return {
          areaId: area.id,
          areaName: area.name,
          id: `resource-${area.id}`,
          message: highRisk
            ? `${timeWindow} ${area.name} 위험도 높음, 소방차 ${recommendedFireEngines}대·구급차 ${recommendedAmbulances}대 전진 배치 권장`
            : `${timeWindow} ${area.name} 위험도 보통, 구급차 ${recommendedAmbulances}대 대기 상태 점검 권장`,
          priority: area.riskLevel,
          reasons: [...derivedReasons, ...area.factors].slice(0, 8),
          recommendedAmbulances,
          recommendedFireEngines,
          recommendedRescueTrucks,
          riskScore: area.riskScore,
          timeWindow,
        } satisfies ResourceRecommendation;
      });
  }
}

export const resourceRecommendationService =
  new ResourceRecommendationService();
