import type { DatasetUpdateProgress } from "@/lib/dataset-progress";
import type { DatasetSourceId } from "@/lib/dataset-sources";

export type EmergencyPointInput = {
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  raw: Record<string, string>;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

export type EmergencyPoint = Omit<EmergencyPointInput, "raw"> & {
  fetchedAt: string | null;
  id: number;
  raw: Record<string, string>;
};

export type EmergencyPointSummary = Omit<EmergencyPoint, "raw">;

export type EmergencyPointMarker = Pick<
  EmergencyPointSummary,
  "category" | "id" | "latitude" | "longitude" | "source"
>;

export type PointBoundingBox = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

export type PointCoordinate = {
  latitude: number;
  longitude: number;
};

export type PointSearchOptions = {
  bounds?: PointBoundingBox;
  center?: PointCoordinate;
  includeUnmapped?: boolean;
  limit?: number;
  source?: DatasetSourceId | null;
  sources?: DatasetSourceId[];
};

export type NearestPoint = EmergencyPointSummary & {
  distanceMeters: number;
};

export type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  importProgress: DatasetImportProgress | null;
  label: string;
  recordCount: number;
  skippedCount: number;
  sourceUrl: string;
  updatedAt: string | null;
  updateProgress: DatasetUpdateProgress | null;
};

export type DatasetUpdateResult = DatasetStatus & {
  importedCount: number;
};

export type DatasetImportMode = "restart" | "resume";

export type DatasetImportProgressStatus = "paused" | "running";

export type DatasetImportProgress = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  mode: DatasetImportMode;
  nextIndex: number;
  reason: string | null;
  skippedCount: number;
  source: DatasetSourceId;
  startedAt: string;
  status: DatasetImportProgressStatus;
  totalCount: number;
  updatedAt: string;
};

export type DatasetImportCheckpoint = DatasetImportProgress & {
  points: EmergencyPointInput[];
};

export type ApiLogInput = {
  action: string;
  category: "dataset" | "geocoding" | "hazard" | "system" | "ui";
  level: "debug" | "error" | "info" | "warn";
  message: string;
  metadata?: Record<string, unknown>;
  requestCount?: number;
  source?: DatasetSourceId | null;
  status: "failure" | "skipped" | "success";
};

export type ApiLogEntry = Required<
  Omit<ApiLogInput, "metadata" | "requestCount" | "source">
> & {
  eventAt: string;
  id: number;
  metadata: Record<string, unknown>;
  requestCount: number;
  source: DatasetSourceId | null;
};

export type ApiUsageWindow = {
  monthlyLimit: number;
  provider: "kakao-local" | "kma-earthquake";
  registeredAt: string | null;
  updatedAt: string | null;
  usedCount: number;
  windowEndsAt: string | null;
  windowStartedAt: string | null;
};

export type AdminUpdateCooldown = {
  action: string;
  available: boolean;
  cooldownMs: number;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
};

export type HazardEventType = "earthquake" | "tsunami";

export type HazardEventInput = {
  eventId: string;
  eventType: HazardEventType;
  title: string;
  issuedAt: string | null;
  occurredAt: string | null;
  latitude: number | null;
  longitude: number | null;
  location: string;
  magnitude: string | null;
  intensity: string | null;
  depth: string | null;
  description: string | null;
  imageUrl: string | null;
  raw: Record<string, string>;
};

export type HazardEvent = HazardEventInput & {
  fetchedAt: string | null;
  id: number;
};

export type HazardEventUpdateResult = {
  fetchedAt: string;
  importedCount: number;
  sources: Array<{
    count: number;
    eventType: HazardEventType;
  }>;
};

export type AssemblyProtestInput = {
  agency: string;
  crowdSize: number | null;
  date: string;
  detailUrl: string | null;
  endsAt: string | null;
  latitude: number | null;
  location: string;
  locationScope: string | null;
  longitude: number | null;
  raw: Record<string, unknown>;
  sourceId: string;
  sourceRecordId: string;
  sourceTitle: string;
  sourceUrl: string;
  startsAt: string | null;
};

export type AssemblyProtest = AssemblyProtestInput & {
  fetchedAt: string;
  id: number;
};

export type AssemblyProtestUpdateResult = {
  date: string;
  failedSourceCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  sourceResults: Array<{
    agency: string;
    error?: string;
    geocodedCount: number;
    importedCount: number;
    sourceId: string;
    status: "failure" | "success";
  }>;
  sourceCount: number;
};

export type AssemblyGeocodeSearchMode = "address" | "both" | "keyword";

export type AssemblyGeocodeCacheInput = {
  latitude: number;
  longitude: number;
  matchedAddress: string | null;
  query: string;
  searchMode: AssemblyGeocodeSearchMode;
  source: string;
};

export type AssemblyGeocodeCacheEntry = AssemblyGeocodeCacheInput & {
  createdAt: string;
  updatedAt: string;
};
