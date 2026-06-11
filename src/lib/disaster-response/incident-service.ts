import { assertKoreaCoordinate } from "@/lib/disaster-response/geo";
import { incidentRepository } from "@/lib/disaster-response/incident-repository";
import type {
  CreateIncidentInput,
  IncidentStatus,
  IncidentType,
  RiskLevel,
} from "@/lib/disaster-response/types";

const INCIDENT_TYPES = new Set<IncidentType>([
  "fire",
  "rescue",
  "medical",
  "traffic",
]);
const RISK_LEVELS = new Set<RiskLevel>(["low", "medium", "high"]);
const INCIDENT_STATUSES = new Set<IncidentStatus>([
  "reported",
  "dispatched",
  "closed",
]);

function boundedText(value: string | undefined, fallback: string, max: number) {
  const text = value?.trim() || fallback;

  return text.slice(0, max);
}

function validDateOrNow(value: string | undefined, now: string) {
  if (!value) {
    return now;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? now : parsed.toISOString();
}

export class IncidentService {
  listIncidents() {
    return incidentRepository.listIncidents();
  }

  getIncident(id: string) {
    return incidentRepository.getIncident(id);
  }

  createIncident(input: CreateIncidentInput) {
    if (!INCIDENT_TYPES.has(input.type)) {
      throw new Error("지원하지 않는 사고 유형입니다.");
    }

    if (!RISK_LEVELS.has(input.riskLevel)) {
      throw new Error("위험도는 low, medium, high 중 하나여야 합니다.");
    }

    assertKoreaCoordinate({
      latitude: input.latitude,
      longitude: input.longitude,
    });

    const now = new Date().toISOString();
    return incidentRepository.createIncident({
      address: boundedText(input.address, "좌표 기반 신고 위치", 240),
      createdAt: now,
      description: boundedText(
        input.description,
        "상세 설명이 없습니다.",
        1200,
      ),
      latitude: input.latitude,
      longitude: input.longitude,
      occurredAt: validDateOrNow(input.occurredAt, now),
      riskLevel: input.riskLevel,
      status: "reported",
      title: boundedText(input.title, "신규 사고 신고", 120),
      type: input.type,
    });
  }

  updateIncidentStatus(id: string, status: IncidentStatus) {
    if (!INCIDENT_STATUSES.has(status)) {
      throw new Error("지원하지 않는 사고 상태입니다.");
    }

    return incidentRepository.updateIncidentStatus(id, status);
  }
}

export const incidentService = new IncidentService();
