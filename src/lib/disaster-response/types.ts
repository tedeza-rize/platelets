export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type IncidentType = "fire" | "rescue" | "medical" | "traffic";

export type RiskLevel = "low" | "medium" | "high";

export type IncidentStatus = "reported" | "dispatched" | "closed";

export type IncidentEventType = "created" | "updated" | "status" | "deleted";

export type Incident = Coordinate & {
  address: string;
  createdAt: string;
  description: string;
  id: string;
  occurredAt: string;
  riskLevel: RiskLevel;
  status: IncidentStatus;
  title: string;
  type: IncidentType;
};

export type IncidentEvent = {
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  createdAt: string;
  fromStatus: IncidentStatus | null;
  id: string;
  incidentId: string;
  message: string;
  toStatus: IncidentStatus | null;
  type: IncidentEventType;
};

export type IncidentActor = {
  id: string | null;
  name: string;
  role: string;
};

export type FireStation = Coordinate & {
  address: string;
  id: string;
  jurisdiction: string;
  name: string;
  resources: {
    ambulances: number;
    fireEngines: number;
    rescueTrucks: number;
  };
};

export type Hospital = Coordinate & {
  address: string;
  emergencyRoom: boolean;
  id: string;
  name: string;
  phone: string;
  specialties: string[];
};

export type RiskArea = Coordinate & {
  baseScore: number;
  factors: string[];
  id: string;
  name: string;
  recentIncidentCount: number;
  riskLevel: RiskLevel;
  riskScore: number;
};

export type BigData119PointKind = "fire-safety-target" | "fire-water-source";

export type BigData119OperationalKind =
  | "call-reception"
  | "ems-dispatch"
  | "rescue-dispatch";

export type BigData119MapPoint = Coordinate & {
  address: string;
  category: string;
  centerName: string | null;
  city: string;
  district: string;
  id: string;
  isSample: boolean;
  kind: BigData119PointKind;
  name: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  stationName: string | null;
  status: string | null;
};

export type BigData119SourceSummary = {
  downloadedAt: string | null;
  fileName: string;
  isSample: boolean;
  kind: BigData119PointKind;
  mappedCount: number;
  pointCount: number;
  regions: string[];
  returnedCount: number;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type BigData119OperationalAreaLoad = {
  areaId: string;
  areaName: string;
  rowCount: number;
};

export type BigData119OperationalSummary = {
  areaLoads: BigData119OperationalAreaLoad[];
  averageDispatchDistanceMeters: number | null;
  downloadedAt: string | null;
  fileName: string;
  incidentTypeHints: string[];
  isSample: boolean;
  kind: BigData119OperationalKind;
  regions: string[];
  resultHints: string[];
  rowCount: number;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  timeHints: string[];
};

export type DispatchRecommendation = {
  distanceMeters: number;
  etaMinutes: number;
  reasons: string[];
  score: number;
  station: FireStation;
};

export type HospitalRecommendation = {
  distanceMeters: number;
  hospital: Hospital;
  reasons: string[];
  score: number;
};

export type ResourceRecommendation = {
  areaId: string;
  areaName: string;
  id: string;
  message: string;
  priority: RiskLevel;
  reasons: string[];
  recommendedAmbulances: number;
  recommendedFireEngines: number;
  recommendedRescueTrucks: number;
  riskScore: number;
  timeWindow: string;
};

export type CreateIncidentInput = {
  address?: string;
  description?: string;
  latitude: number;
  longitude: number;
  occurredAt?: string;
  riskLevel: RiskLevel;
  title?: string;
  type: IncidentType;
};

export type UpdateIncidentInput = {
  address?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  occurredAt?: string;
  riskLevel?: RiskLevel;
  title?: string;
  type?: IncidentType;
};
