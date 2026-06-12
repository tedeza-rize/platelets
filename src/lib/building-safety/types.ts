import type { Coordinate } from "@/lib/disaster-response/types";

export type BuildingSafetySource = {
  accessType: "free" | "paid" | "restricted" | "sample";
  dataFormat: "image" | "mixed" | "structured" | "unstructured";
  id: string;
  label: string;
  notes: string[];
  provider: string;
  sourceUrl: string;
  usage: string;
};

export type EvacuationExit = Coordinate & {
  direction: string;
  floor: string;
  id: string;
  label: string;
};

export type EvacuationRoute = {
  estimatedDistanceMeters: number | null;
  floor: string;
  from: string;
  to: string;
  via: string[];
};

export type BuildingFloorPlan = {
  evacuationRoutes: EvacuationRoute[];
  exits: string[];
  floor: string;
  hazards: string[];
  keySpaces: string[];
  refugeArea: string | null;
  sectionNote: string | null;
};

export type BuildingSectionLevel = {
  floor: string;
  label: string;
  riskNote: string | null;
  use: string;
  verticalExitAccess: string[];
};

export type BuildingSafetyProfile = Coordinate & {
  address: string;
  dataStatus: "sample" | "verified";
  exits: EvacuationExit[];
  floors: BuildingFloorPlan[];
  id: string;
  name: string;
  nearestAssemblyPoint: string;
  section: BuildingSectionLevel[];
  sourceIds: string[];
  sourceLabel: string;
  sourceNotes: string[];
  sourceUrl: string | null;
  updatedAt: string;
};
