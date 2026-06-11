import {
  distanceMeters,
  estimatedUrbanEtaMinutes,
} from "@/lib/disaster-response/geo";
import { FIRE_STATIONS } from "@/lib/disaster-response/mock-data";
import type {
  Coordinate,
  DispatchRecommendation,
  Incident,
} from "@/lib/disaster-response/types";
import {
  type EmergencyPointSummary,
  listPointSummaries,
} from "@/lib/points-db";

function mapFireStation(point: EmergencyPointSummary) {
  return {
    address: point.address,
    id: `point-${point.id}`,
    jurisdiction: point.address.split(/\s+/).slice(0, 2).join(" ") || "인근",
    latitude: point.latitude as number,
    longitude: point.longitude as number,
    name: point.name,
    resources: {
      ambulances: /119|안전센터|구급/.test(`${point.name} ${point.category}`)
        ? 2
        : 1,
      fireEngines: /소방서/.test(point.category) ? 5 : 2,
      rescueTrucks: /구조|소방서/.test(`${point.name} ${point.category}`)
        ? 2
        : 1,
    },
  };
}

function isMappedPoint(point: EmergencyPointSummary) {
  return point.latitude !== null && point.longitude !== null;
}

export class FireStationService {
  async listFireStations() {
    const points = await listPointSummaries({
      limit: 5_000,
      source: "fire-stations",
    });
    const stations = points.filter(isMappedPoint).map(mapFireStation);

    return stations.length > 0 ? stations : FIRE_STATIONS;
  }

  async recommendForIncident(
    incident: Incident,
  ): Promise<DispatchRecommendation | null> {
    const origin: Coordinate = {
      latitude: incident.latitude,
      longitude: incident.longitude,
    };
    const stations = await this.listFireStations();
    const [best] = stations
      .map((station) => {
        const distance = distanceMeters(origin, station);
        const etaMinutes = estimatedUrbanEtaMinutes(distance);
        const typeWeight =
          incident.type === "fire"
            ? station.resources.fireEngines * 8
            : incident.type === "medical"
              ? station.resources.ambulances * 9
              : station.resources.rescueTrucks * 8;
        const score = Math.round(
          Math.max(0, 100 - etaMinutes * 4) + typeWeight,
        );
        const reasons = [
          `${Math.round(distance).toLocaleString("ko-KR")}m 거리`,
          `예상 ${etaMinutes}분 내 접근`,
          `${station.jurisdiction} 관할 또는 인접 권역`,
        ];

        if (incident.type === "fire") {
          reasons.push(`펌프차 ${station.resources.fireEngines}대 보유`);
        }
        if (incident.type === "medical") {
          reasons.push(`구급차 ${station.resources.ambulances}대 보유`);
        }
        if (incident.type === "rescue" || incident.type === "traffic") {
          reasons.push(`구조차 ${station.resources.rescueTrucks}대 보유`);
        }
        reasons.push("향후 교통상황·과거 출동시간 가중치 확장 가능");

        return {
          distanceMeters: Math.round(distance),
          etaMinutes,
          reasons,
          score,
          station,
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.distanceMeters - right.distanceMeters,
      );

    return best ?? null;
  }
}

export const fireStationService = new FireStationService();
