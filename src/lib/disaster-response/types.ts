export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type IncidentType = "fire" | "rescue" | "medical" | "traffic";

export type RiskLevel = "low" | "medium" | "high";

export type IncidentStatus = "reported" | "dispatched" | "closed";

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
