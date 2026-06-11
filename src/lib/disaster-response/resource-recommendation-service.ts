import type {
  ResourceRecommendation,
  RiskArea,
} from "@/lib/disaster-response/types";

export class ResourceRecommendationService {
  buildRecommendations(riskAreas: RiskArea[]): ResourceRecommendation[] {
    return riskAreas
      .filter((area) => area.riskLevel !== "low")
      .map((area) => {
        const highRisk = area.riskLevel === "high";

        return {
          areaId: area.id,
          areaName: area.name,
          id: `resource-${area.id}`,
          message: highRisk
            ? `금일 14~18시 ${area.name} 위험도 높음, 소방차 추가 배치 권장`
            : `${area.name} 위험도 보통, 구급차 대기 상태 점검 권장`,
          priority: area.riskLevel,
          reasons: area.factors.slice(0, 5),
          recommendedAmbulances: highRisk ? 2 : 1,
          recommendedFireEngines: highRisk ? 2 : 1,
          timeWindow: "금일 14:00-18:00",
        } satisfies ResourceRecommendation;
      });
  }
}

export const resourceRecommendationService =
  new ResourceRecommendationService();
