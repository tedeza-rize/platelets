import {
  listBigData119OperationalSummaries,
  summarizeOperationalLoadForRiskArea,
} from "@/lib/disaster-response/bigdata119-operational-data";
import {
  type FireSafetyRegionalStat,
  listFireSafetyRegionalStats,
  summarizeStatsForRiskArea,
} from "@/lib/disaster-response/bigdata119-risk-data";
import { distanceMeters } from "@/lib/disaster-response/geo";
import { BASE_RISK_AREAS } from "@/lib/disaster-response/mock-data";
import type {
  BigData119OperationalSummary,
  Incident,
  RiskArea,
  RiskLevel,
} from "@/lib/disaster-response/types";
import { type EmergencyPointMarker, listPointMarkers } from "@/lib/points-db";

type MappedPoint = EmergencyPointMarker & {
  latitude: number;
  longitude: number;
};

type RiskInfrastructureContext = {
  fireSafetyTargetCounts: Map<string, number>;
  fireWaterSourceCounts: Map<string, number>;
  operationalSummaries: BigData119OperationalSummary[];
  regionalStats: FireSafetyRegionalStat[];
};

function calculateResourceCoverageScore(
  regionalStat: Pick<
    FireSafetyRegionalStat,
    "ambulanceCount" | "fireEngineCount"
  > | null,
) {
  if (!regionalStat) {
    return 0;
  }

  const resourceCount =
    regionalStat.fireEngineCount + regionalStat.ambulanceCount;
  if (resourceCount >= 50) {
    return -5;
  }

  return resourceCount >= 25 ? -2 : 4;
}

function riskLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function timeOfDayScore(now = new Date()) {
  const hour = now.getHours();

  if (hour >= 14 && hour <= 20) return 10;
  if (hour >= 7 && hour <= 9) return 6;
  if (hour >= 22 || hour <= 5) return 8;
  return 2;
}

export class RiskPredictionService {
  async buildInfrastructureContext(): Promise<RiskInfrastructureContext> {
    const [
      fireSafetyTargets,
      busanFireSafetyTargets,
      fireWaterSources,
      busanFireWaterSources,
    ] = await Promise.all([
      listPointMarkers({
        limit: 20_000,
        source: "fire-safety-targets",
      }),
      listPointMarkers({
        limit: 20_000,
        source: "busan-fire-safety-targets",
      }),
      listPointMarkers({
        limit: 20_000,
        source: "fire-water-sources",
      }),
      listPointMarkers({
        limit: 20_000,
        source: "busan-fire-water-sources",
      }),
    ]);

    return {
      fireSafetyTargetCounts: this.countNearbyByArea([
        ...fireSafetyTargets,
        ...busanFireSafetyTargets,
      ]),
      fireWaterSourceCounts: this.countNearbyByArea([
        ...fireWaterSources,
        ...busanFireWaterSources,
      ]),
      operationalSummaries: listBigData119OperationalSummaries(),
      regionalStats: listFireSafetyRegionalStats(),
    };
  }

  calculateRiskAreas(
    incidents: Incident[],
    now = new Date(),
    infrastructure?: RiskInfrastructureContext,
  ): RiskArea[] {
    return BASE_RISK_AREAS.map((area) => {
      const nearbyIncidents = incidents.filter(
        (incident) => distanceMeters(area, incident) <= 4_500,
      );
      const recentIncidentCount = nearbyIncidents.length;
      const severeCount = nearbyIncidents.filter(
        (incident) => incident.riskLevel === "high",
      ).length;
      const fireSafetyTargetCount =
        infrastructure?.fireSafetyTargetCounts.get(area.id) ?? 0;
      const fireWaterSourceCount =
        infrastructure?.fireWaterSourceCounts.get(area.id) ?? 0;
      const regionalStat = infrastructure
        ? summarizeStatsForRiskArea(area, infrastructure.regionalStats)
        : null;
      const operationalLoad = infrastructure
        ? summarizeOperationalLoadForRiskArea(
            area,
            infrastructure.operationalSummaries,
          )
        : null;
      const fireSafetyTargetScore = Math.min(18, fireSafetyTargetCount * 3);
      const fireWaterCoverageScore =
        fireWaterSourceCount > 0 ? -Math.min(6, fireWaterSourceCount) : 4;
      const fireHistoryScore = regionalStat
        ? Math.min(16, Math.round(Math.log1p(regionalStat.fireCount) * 2.4))
        : 0;
      const rescueLoadScore = regionalStat
        ? Math.min(10, Math.round(Math.log1p(regionalStat.rescueCount) * 1.5))
        : 0;
      const casualtyScore = regionalStat
        ? Math.min(8, Math.round(Math.log1p(regionalStat.casualtyCount) * 1.2))
        : 0;
      const resourceCoverageScore =
        calculateResourceCoverageScore(regionalStat);
      const operationalLoadScore = operationalLoad
        ? Math.min(12, Math.round(Math.log1p(operationalLoad.rowCount) * 2.5))
        : 0;
      const score = Math.min(
        100,
        Math.round(
          area.baseScore +
            recentIncidentCount * 8 +
            severeCount * 10 +
            fireSafetyTargetScore +
            fireWaterCoverageScore +
            fireHistoryScore +
            rescueLoadScore +
            casualtyScore +
            resourceCoverageScore +
            operationalLoadScore +
            timeOfDayScore(now),
        ),
      );
      const factors = [
        ...area.factors,
        `최근 사고 ${recentIncidentCount}건`,
        `소방안전 빅데이터 특정소방대상물 ${fireSafetyTargetCount}건`,
        fireWaterSourceCount > 0
          ? `소방용수 ${fireWaterSourceCount}건 확인`
          : "소방용수 데이터 없음",
        regionalStat
          ? `${regionalStat.sourceLabel}: ${regionalStat.dataYear}년 화재 ${regionalStat.fireCount.toLocaleString("ko-KR")}건, 구조 ${regionalStat.rescueCount.toLocaleString("ko-KR")}건`
          : "전국 화재·소방력 통계 미연결",
        regionalStat
          ? `소방력 참고: 소방차 ${regionalStat.fireEngineCount.toLocaleString("ko-KR")}대, 구급차 ${regionalStat.ambulanceCount.toLocaleString("ko-KR")}대`
          : "소방력 통계 없음",
        operationalLoad
          ? `119 신고·출동 샘플 ${operationalLoad.rowCount.toLocaleString("ko-KR")}건 반영: ${operationalLoad.sourceLabels.join(", ")}`
          : "119 신고·출동 운영 데이터 지역 매칭 없음",
        `시간대 가중치 +${timeOfDayScore(now)}`,
      ];

      return {
        ...area,
        factors,
        recentIncidentCount,
        riskLevel: riskLevel(score),
        riskScore: score,
      };
    }).sort((left, right) => right.riskScore - left.riskScore);
  }

  private countNearbyByArea(points: EmergencyPointMarker[]) {
    const mappedPoints = points.filter(
      (point): point is MappedPoint =>
        point.latitude !== null && point.longitude !== null,
    );

    return new Map(
      BASE_RISK_AREAS.map((area) => [
        area.id,
        mappedPoints.filter((point) => distanceMeters(area, point) <= 4_500)
          .length,
      ]),
    );
  }
}

export const riskPredictionService = new RiskPredictionService();
