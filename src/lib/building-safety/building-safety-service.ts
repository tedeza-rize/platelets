import type {
  BuildingSafetyProfile,
  EvacuationExit,
} from "@/lib/building-safety/types";
import { distanceMeters } from "@/lib/disaster-response/geo";
import type { Coordinate } from "@/lib/disaster-response/types";

const SAMPLE_SOURCE_LABEL = "발표용 건물 안전 프로필 샘플";

function exit(
  id: string,
  label: string,
  floor: string,
  direction: string,
  coordinate: Coordinate,
): EvacuationExit {
  return {
    direction,
    floor,
    id,
    label,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}

const BUILDING_SAFETY_PROFILES: BuildingSafetyProfile[] = [
  {
    address: "서울특별시 중구 세종대로 110",
    dataStatus: "sample",
    exits: [
      exit("seoul-cityhall-exit-north", "북측 주출입구", "1F", "세종대로", {
        latitude: 37.5669,
        longitude: 126.978,
      }),
      exit("seoul-cityhall-exit-south", "남측 비상구", "1F", "덕수궁 방면", {
        latitude: 37.5661,
        longitude: 126.9782,
      }),
    ],
    floors: [
      {
        floor: "B1",
        hazards: ["지하 보행 연결부", "기계실"],
        keySpaces: ["상황실", "전기실"],
        refugeArea: "지상 광장",
      },
      {
        floor: "1F",
        hazards: ["민원 대기공간", "출입구 혼잡"],
        keySpaces: ["로비", "민원실"],
        refugeArea: "서울광장",
      },
    ],
    id: "building-seoul-cityhall",
    latitude: 37.5665,
    longitude: 126.978,
    name: "서울시청 본관",
    nearestAssemblyPoint: "서울광장",
    sourceLabel: SAMPLE_SOURCE_LABEL,
    sourceUrl: null,
  },
  {
    address: "부산광역시 연제구 중앙대로 1001",
    dataStatus: "sample",
    exits: [
      exit("busan-cityhall-exit-main", "남측 주출입구", "1F", "중앙대로", {
        latitude: 35.1795,
        longitude: 129.075,
      }),
      exit("busan-cityhall-exit-east", "동측 비상구", "1F", "시청역 방면", {
        latitude: 35.1798,
        longitude: 129.0756,
      }),
    ],
    floors: [
      {
        floor: "1F",
        hazards: ["민원실", "대형 로비"],
        keySpaces: ["안내데스크", "방재실"],
        refugeArea: "시청 앞 광장",
      },
      {
        floor: "2F",
        hazards: ["업무공간 밀집"],
        keySpaces: ["회의실", "민원 처리 부서"],
        refugeArea: "중앙계단 및 외부 광장",
      },
    ],
    id: "building-busan-cityhall",
    latitude: 35.1798,
    longitude: 129.0751,
    name: "부산광역시청",
    nearestAssemblyPoint: "부산시청 앞 광장",
    sourceLabel: SAMPLE_SOURCE_LABEL,
    sourceUrl: null,
  },
  {
    address: "부산광역시 해운대구 APEC로 55",
    dataStatus: "sample",
    exits: [
      exit("bexco-exit-west", "서측 출입구", "1F", "센텀시티역 방면", {
        latitude: 35.1695,
        longitude: 129.1356,
      }),
      exit("bexco-exit-east", "동측 비상구", "1F", "APEC로", {
        latitude: 35.1693,
        longitude: 129.1374,
      }),
    ],
    floors: [
      {
        floor: "1F",
        hazards: ["전시장 대형 개방 공간", "행사 인파"],
        keySpaces: ["제1전시장", "로비", "방재센터"],
        refugeArea: "야외 광장",
      },
      {
        floor: "2F",
        hazards: ["회의실 밀집", "연결 통로"],
        keySpaces: ["컨벤션홀", "회의실"],
        refugeArea: "외부 계단 및 야외 광장",
      },
    ],
    id: "building-bexco",
    latitude: 35.1695,
    longitude: 129.1366,
    name: "벡스코",
    nearestAssemblyPoint: "벡스코 야외 광장",
    sourceLabel: SAMPLE_SOURCE_LABEL,
    sourceUrl: null,
  },
];

export class BuildingSafetyService {
  listProfiles() {
    return BUILDING_SAFETY_PROFILES;
  }

  findNearestProfile(coordinate: Coordinate, radiusMeters = 260) {
    const [nearest] = BUILDING_SAFETY_PROFILES.map((profile) => ({
      distanceMeters: distanceMeters(coordinate, profile),
      profile,
    }))
      .filter((item) => item.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    return nearest ?? null;
  }
}

export const buildingSafetyService = new BuildingSafetyService();
