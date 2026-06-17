import type Database from "better-sqlite3";
import type { AssemblyPoliceAgency, DatasetSourceId } from "./constants.ts";

export type SqliteDatabase = Database.Database;

export function emergencyBedAvailability(emergencyBeds: number | null) {
  if (emergencyBeds === null) {
    return 0.45;
  }

  return emergencyBeds > 0 ? 1 : 0.05;
}

export type PointRow = {
  address: string;
  category: string;
  fetched_at: string | null;
  id: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parent_name: string | null;
  phone: string | null;
  source: DatasetSourceId;
  source_record_id: string;
  source_updated_at: string | null;
};

export type PointWithRawRow = PointRow & {
  raw_json: string;
};

export type DatasetStatusRow = {
  error: string | null;
  failed_count: number;
  fetched_at: string | null;
  geocoded_count: number;
  label: string;
  record_count: number;
  skipped_count: number;
  source: DatasetSourceId;
  updated_at: string | null;
};

export type AssemblyProtestRow = {
  agency: string;
  crowd_size: number | null;
  date: string;
  detail_url: string | null;
  ends_at: string | null;
  fetched_at: string;
  id: number;
  latitude: number | null;
  location: string;
  location_scope: string | null;
  longitude: number | null;
  source_id: AssemblyPoliceAgency;
  source_record_id: string;
  source_title: string;
  source_url: string;
  starts_at: string | null;
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type PointBounds = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

export type PointSearchOptions = {
  bounds?: PointBounds;
  includeUnmapped?: boolean;
  limit?: number;
  source?: DatasetSourceId;
};

export type PointSummary = {
  address: string;
  category: string;
  fetchedAt: string | null;
  id: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

export type AssemblyProtestSummary = {
  agency: string;
  crowdSize: number | null;
  date: string;
  detailUrl: string | null;
  endsAt: string | null;
  fetchedAt: string;
  id: number;
  latitude: number | null;
  location: string;
  locationScope: string | null;
  longitude: number | null;
  sourceId: AssemblyPoliceAgency;
  sourceRecordId: string;
  sourceTitle: string;
  sourceUrl: string;
  startsAt: string | null;
};

export type MappedPoint = Omit<PointSummary, "latitude" | "longitude"> &
  Coordinate;

export type NearestPoint = MappedPoint & {
  distanceMeters: number;
};

export type EmergencyScenario =
  | "general"
  | "pediatric-respiratory"
  | "cardiac"
  | "stroke"
  | "trauma"
  | "burn"
  | "delivery"
  | "elderly-fall";

export const STRICT_EMERGENCY_SCENARIOS = new Set<EmergencyScenario>([
  "pediatric-respiratory",
  "cardiac",
  "stroke",
  "trauma",
  "burn",
  "delivery",
]);

export type EmergencyCandidate = MappedPoint & {
  raw: Record<string, string>;
  distanceMeters: number;
};

export type KakaoDirectionSummary = {
  distanceMeters: number;
  durationSeconds: number;
  fare: unknown;
  priority: string;
};

export type KakaoDirectionError = {
  error: string;
  resultCode?: number | null;
};

export type KakaoDirectionResult =
  | KakaoDirectionError
  | KakaoDirectionSummary
  | null;

export type EmergencyHospitalRecommendation = {
  address: string;
  category: string;
  distanceMeters: number;
  durationSeconds: number;
  emergencyBeds: number | null;
  id: number;
  name: string;
  phone: string | null;
  route: KakaoDirectionResult;
  score: number;
  scoreBasis: string;
  scenarioMinimum: string;
  sourceUpdatedAt: string | null;
};

export type VworldSearchResult = Coordinate & {
  matchedAddress: string | null;
  query: string;
  source: string;
  title: string | null;
};

export type RankedResponsePoint = NearestPoint & {
  route: KakaoDirectionResult;
  scoreBasis: "kakao-route-duration" | "straight-line-distance";
};

export type ToolResult = {
  content: Array<{
    text: string;
    type: "text";
  }>;
  structuredContent: Record<string, unknown>;
};

export type KakaoDirectionsResponse = {
  routes?: Array<{
    result_code?: number;
    result_msg?: string;
    summary?: {
      distance?: number;
      duration?: number;
      fare?: unknown;
      priority?: string;
    };
  }>;
};

export type KakaoLocalSearchKind = "address" | "keyword";

export type KakaoLocalSearchResponse = {
  documents?: Array<{
    address?: {
      address_name?: string;
    } | null;
    address_name?: string;
    place_name?: string;
    road_address?: {
      address_name?: string;
    } | null;
    x?: string;
    y?: string;
  }>;
  errorType?: string;
  message?: string;
  meta?: {
    total_count?: number;
  };
};

export type VworldSearchMode = "address" | "both" | "keyword";

export type VworldAddressResponse = {
  response?: {
    error?: {
      code?: string;
      text?: string;
    };
    result?:
      | {
          point?: {
            x?: string;
            y?: string;
          };
        }
      | Array<{
          text?: string;
        }>;
    status?: string;
  };
};

export type VworldSearchResponse = {
  response?: {
    error?: {
      code?: string;
      text?: string;
    };
    result?: {
      items?: Array<{
        address?: {
          parcel?: string;
          road?: string;
        };
        point?: {
          x?: string;
          y?: string;
        };
        title?: string;
      }>;
    };
    status?: string;
  };
};
