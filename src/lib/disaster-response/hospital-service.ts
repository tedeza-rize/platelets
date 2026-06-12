import { distanceMeters } from "@/lib/disaster-response/geo";
import { HOSPITALS } from "@/lib/disaster-response/mock-data";
import type {
  Coordinate,
  HospitalRecommendation,
  Incident,
  IncidentType,
} from "@/lib/disaster-response/types";
import { type EmergencyPoint, listPoints } from "@/lib/points-db";

const TYPE_SPECIALTIES: Record<IncidentType, string[]> = {
  fire: ["화상", "응급의학", "중환자"],
  medical: ["응급의학", "심혈관", "소아", "중환자"],
  rescue: ["외상", "정형외과", "응급의학"],
  traffic: ["외상", "응급의학", "정형외과"],
};

function rawText(point: EmergencyPoint) {
  return Object.values(point.raw).filter(Boolean).join(" ");
}

function specialtiesFromPoint(point: EmergencyPoint) {
  const text = `${point.category} ${point.name} ${rawText(point)}`;
  const specialties = new Set<string>();

  for (const specialty of [
    "응급의학",
    "외상",
    "화상",
    "심혈관",
    "소아",
    "중환자",
    "정형외과",
    "내과",
    "감염",
  ]) {
    if (text.includes(specialty)) {
      specialties.add(specialty);
    }
  }

  if (specialties.size === 0 && /응급|권역|지역응급|센터/.test(text)) {
    specialties.add("응급의학");
  }

  return Array.from(specialties);
}

function mapHospital(point: EmergencyPoint, emergencyRoom: boolean) {
  return {
    address: point.address,
    emergencyRoom,
    id: `point-${point.id}`,
    latitude: point.latitude as number,
    longitude: point.longitude as number,
    name: point.name,
    phone: point.phone ?? "-",
    specialties: specialtiesFromPoint(point),
  };
}

function isMappedPoint(point: EmergencyPoint) {
  return point.latitude !== null && point.longitude !== null;
}

export class HospitalService {
  async listHospitals() {
    const emergencyInstitutions = await listPoints({
      limit: 5_000,
      source: "emergency-medical-institutions",
    });
    const emergencyHospitals = emergencyInstitutions
      .filter(isMappedPoint)
      .map((point) => mapHospital(point, true));

    if (emergencyHospitals.length > 0) {
      return emergencyHospitals;
    }

    const hospitals = await listPoints({ limit: 5_000, source: "hospitals" });
    const mappedHospitals = hospitals
      .filter(isMappedPoint)
      .map((point) => mapHospital(point, point.raw.dutyEryn === "1"));

    return mappedHospitals.length > 0 ? mappedHospitals : HOSPITALS;
  }

  async recommendHospitals(
    incident: Incident,
    limit = 3,
  ): Promise<HospitalRecommendation[]> {
    const origin: Coordinate = {
      latitude: incident.latitude,
      longitude: incident.longitude,
    };
    const preferred = TYPE_SPECIALTIES[incident.type];
    const hospitals = await this.listHospitals();

    return hospitals
      .map((hospital) => {
        const distance = distanceMeters(origin, hospital);
        const specialtyMatches = preferred.filter((specialty) =>
          hospital.specialties.includes(specialty),
        );
        const distanceScore = Math.max(0, 45 - Math.min(45, distance / 220));
        const emergencyBonus = hospital.emergencyRoom ? 25 : 0;
        const specialtyBonus = Math.min(24, specialtyMatches.length * 12);
        const riskBonus =
          incident.riskLevel === "high" && hospital.emergencyRoom ? 6 : 0;
        const score = Math.round(
          distanceScore + emergencyBonus + specialtyBonus + riskBonus,
        );
        const reasons = [
          `${Math.round(distance).toLocaleString("ko-KR")}m 거리`,
          hospital.emergencyRoom ? "응급실 운영" : "응급실 정보 없음",
        ];

        if (specialtyMatches.length > 0) {
          reasons.push(`${specialtyMatches.join(", ")} 진료역량 우선`);
        } else {
          reasons.push(
            `${TYPE_SPECIALTIES[incident.type].join(", ")} 역량 확인 필요`,
          );
        }

        if (incident.riskLevel === "high") {
          reasons.push("고위험 사고로 응급실·전문진료 우선");
        }

        return {
          distanceMeters: Math.round(distance),
          hospital,
          reasons,
          score,
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.distanceMeters - right.distanceMeters,
      )
      .slice(0, limit);
  }
}

export const hospitalService = new HospitalService();
