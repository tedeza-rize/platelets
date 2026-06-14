import fs from "node:fs";
import path from "node:path";
import type {
  BuildingSafetyProfile,
  BuildingSafetySource,
} from "@/lib/building-safety/types";
import { distanceMeters } from "@/lib/disaster-response/geo";
import type { Coordinate } from "@/lib/disaster-response/types";

type BuildingSafetyDataFile = {
  profiles: BuildingSafetyProfile[];
  sources: BuildingSafetySource[];
};

type ProfileMatch = {
  distanceMeters: number;
  profile: BuildingSafetyProfile;
};

const DATA_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "building-safety",
  "profiles.json",
);

const FALLBACK_DATA: BuildingSafetyDataFile = {
  profiles: [],
  sources: [
    {
      accessType: "sample",
      dataFormat: "structured",
      id: "fallback-building-safety",
      label: "건물 안전 데이터 파일 없음",
      notes: [
        "data/building-safety/profiles.json 파일을 확인해야 합니다.",
        "승인된 단면도·비상구 데이터가 확보되면 같은 스키마로 교체합니다.",
      ],
      provider: "local",
      sourceUrl: "/api/building-safety",
      usage: "건물 안전 프로필 데이터 로딩 실패 안내",
    },
  ],
};

let cachedData: BuildingSafetyDataFile | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBuildingSafetyData(): BuildingSafetyDataFile {
  if (cachedData) {
    return cachedData;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(DATA_FILE_PATH, "utf8"),
    ) as unknown;

    if (
      !(
        isRecord(parsed) &&
        Array.isArray(parsed.profiles) &&
        Array.isArray(parsed.sources)
      )
    ) {
      throw new Error("Invalid building safety data shape.");
    }

    cachedData = {
      profiles: parsed.profiles as BuildingSafetyProfile[],
      sources: parsed.sources as BuildingSafetySource[],
    };
  } catch {
    cachedData = FALLBACK_DATA;
  }

  return cachedData;
}

export class BuildingSafetyService {
  listProfiles() {
    return readBuildingSafetyData().profiles;
  }

  listSources(sourceIds?: string[]) {
    const sources = readBuildingSafetyData().sources;

    if (!sourceIds || sourceIds.length === 0) {
      return sources;
    }

    const requested = new Set(sourceIds);

    return sources.filter((source) => requested.has(source.id));
  }

  findNearestProfile(
    coordinate: Coordinate,
    radiusMeters = 260,
  ): ProfileMatch | null {
    const [nearest] = this.listProfiles()
      .map((profile) => ({
        distanceMeters: distanceMeters(coordinate, profile),
        profile,
      }))
      .filter((item) => item.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    return nearest ?? null;
  }
}

export const buildingSafetyService = new BuildingSafetyService();
