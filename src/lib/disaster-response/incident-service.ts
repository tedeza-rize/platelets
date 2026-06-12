import { assertKoreaCoordinate } from "@/lib/disaster-response/geo";
import { incidentRepository } from "@/lib/disaster-response/incident-repository";
import type {
  CreateIncidentInput,
  Incident,
  IncidentStatus,
  IncidentType,
  RiskLevel,
  UpdateIncidentInput,
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

function validDateOrFallback(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function editableIncidentFields(incident: Incident) {
  return {
    address: incident.address,
    description: incident.description,
    latitude: incident.latitude,
    longitude: incident.longitude,
    occurredAt: incident.occurredAt,
    riskLevel: incident.riskLevel,
    title: incident.title,
    type: incident.type,
  };
}

export class IncidentService {
  listIncidents() {
    return incidentRepository.listIncidents();
  }

  getIncident(id: string) {
    return incidentRepository.getIncident(id);
  }

  listIncidentEvents(id: string) {
    return incidentRepository.listIncidentEvents(id);
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

  async updateIncident(id: string, input: UpdateIncidentInput) {
    const current = await incidentRepository.getIncident(id);

    if (!current) {
      return null;
    }

    const type = input.type ?? current.type;
    const riskLevel = input.riskLevel ?? current.riskLevel;

    if (!INCIDENT_TYPES.has(type)) {
      throw new Error("지원하지 않는 사고 유형입니다.");
    }

    if (!RISK_LEVELS.has(riskLevel)) {
      throw new Error("위험도는 low, medium, high 중 하나여야 합니다.");
    }

    const latitude = input.latitude ?? current.latitude;
    const longitude = input.longitude ?? current.longitude;
    assertKoreaCoordinate({ latitude, longitude });

    return incidentRepository.updateIncident(id, {
      ...editableIncidentFields(current),
      address: boundedText(input.address, current.address, 240),
      description: boundedText(input.description, current.description, 1200),
      latitude,
      longitude,
      occurredAt: validDateOrFallback(input.occurredAt, current.occurredAt),
      riskLevel,
      title: boundedText(input.title, current.title, 120),
      type,
    });
  }

  deleteIncident(id: string) {
    return incidentRepository.deleteIncident(id);
  }
}

export const incidentService = new IncidentService();
