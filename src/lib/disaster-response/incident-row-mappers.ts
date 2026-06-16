import type {
  Incident,
  IncidentEvent,
  IncidentEventType,
  IncidentStatus,
  IncidentType,
  RiskLevel,
} from "@/lib/disaster-response/types";

export type IncidentRow = {
  address: string;
  created_at: string;
  deleted_at: string | null;
  description: string;
  id: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  risk_level: string;
  status: string;
  title: string;
  type: string;
  updated_at: string;
};

export type IncidentEventRow = {
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
  from_status: string | null;
  id: string;
  incident_id: string;
  message: string;
  to_status: string | null;
  type: string;
};

export function asIncidentStatus(value: string): IncidentStatus {
  return value === "dispatched" || value === "closed" || value === "reported"
    ? value
    : "reported";
}

function asIncidentType(value: string): IncidentType {
  return value === "rescue" ||
    value === "medical" ||
    value === "traffic" ||
    value === "fire"
    ? value
    : "fire";
}

function asRiskLevel(value: string): RiskLevel {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function asIncidentEventType(value: string): IncidentEventType {
  return value === "created" ||
    value === "updated" ||
    value === "status" ||
    value === "deleted"
    ? value
    : "updated";
}

export function mapIncidentRow(row: IncidentRow): Incident {
  return {
    address: row.address,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    occurredAt: row.occurred_at,
    riskLevel: asRiskLevel(row.risk_level),
    status: asIncidentStatus(row.status),
    title: row.title,
    type: asIncidentType(row.type),
  };
}

export function mapIncidentEventRow(row: IncidentEventRow): IncidentEvent {
  return {
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    createdAt: row.created_at,
    fromStatus: row.from_status ? asIncidentStatus(row.from_status) : null,
    id: row.id,
    incidentId: row.incident_id,
    message: row.message,
    toStatus: row.to_status ? asIncidentStatus(row.to_status) : null,
    type: asIncidentEventType(row.type),
  };
}
