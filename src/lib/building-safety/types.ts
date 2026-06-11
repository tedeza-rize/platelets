import type { Coordinate } from "@/lib/disaster-response/types";

export type EvacuationExit = Coordinate & {
  direction: string;
  floor: string;
  id: string;
  label: string;
};

export type BuildingFloorPlan = {
  floor: string;
  hazards: string[];
  keySpaces: string[];
  refugeArea: string | null;
};

export type BuildingSafetyProfile = Coordinate & {
  address: string;
  dataStatus: "sample" | "verified";
  exits: EvacuationExit[];
  floors: BuildingFloorPlan[];
  id: string;
  name: string;
  nearestAssemblyPoint: string;
  sourceLabel: string;
  sourceUrl: string | null;
};
