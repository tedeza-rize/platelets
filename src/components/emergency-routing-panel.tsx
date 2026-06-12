"use client";

import { Ambulance, Flame, LoaderCircle, Route, X } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./map-shell.module.css";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type HospitalRecommendation = {
  address: string;
  category: string;
  distanceMeters: number;
  durationSeconds: number;
  etaSource: "estimated" | "kakao";
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  phone: string;
  reasons: string[];
  score: number;
};

type DispatchStation = {
  distanceMeters: number;
  name: string;
};

export type EmergencyRouteResult = {
  baseDurationSeconds?: number;
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  provider: "astar" | "kakao";
  traffic?: {
    averageSpeedKph: number | null;
    congestionLevel: "congested" | "moderate" | "smooth" | "unknown";
    durationMultiplier: number;
    message: string;
    provider: "its" | "kakao" | "none";
    sampleCount: number;
    status: "live" | "unavailable" | "unconfigured";
  };
};

type RecommendationResponse = {
  dispatchStation: DispatchStation | null;
  error?: string;
  hospitals: HospitalRecommendation[];
};

const SYMPTOMS = [
  ["general", "일반 구급"],
  ["respiratory", "호흡곤란"],
  ["cardiac", "심정지·흉통"],
  ["stroke", "뇌졸중 의심"],
  ["trauma", "중증외상"],
  ["burn", "화상"],
  ["delivery", "임산부·분만"],
  ["fall", "낙상·골절"],
] as const;

function scenarioFor(patientType: string, symptom: string) {
  if (symptom === "cardiac") return "cardiac";
  if (symptom === "stroke") return "stroke";
  if (symptom === "trauma") return "trauma";
  if (symptom === "burn") return "burn";
  if (symptom === "delivery" || patientType === "pregnant") return "delivery";
  if (symptom === "fall" || patientType === "elderly") return "elderly-fall";
  if (symptom === "respiratory" && patientType === "infant") {
    return "pediatric-respiratory";
  }
  return "general";
}

function minutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function routeProviderLabel(route: EmergencyRouteResult) {
  if (route.provider === "kakao") {
    return route.traffic?.status === "live" ? "카카오 교통 반영" : "카카오맵";
  }

  return route.traffic?.status === "live" ? "자체 A* + ITS 교통" : "자체 A*";
}

function routeTrafficText(route: EmergencyRouteResult) {
  if (!route.traffic) {
    return null;
  }

  if (route.traffic.status === "unconfigured") {
    return "ITS 교통 API 키 미설정";
  }

  return route.traffic.message;
}

export function EmergencyRoutingPanel({
  onClose,
  onRoute,
  origin,
}: {
  onClose: () => void;
  onRoute: (route: EmergencyRouteResult) => void;
  origin: Coordinate;
}) {
  const [incidentType, setIncidentType] = useState<"ambulance" | "fire">(
    "ambulance",
  );
  const [patientType, setPatientType] = useState("none");
  const [symptom, setSymptom] = useState("general");
  const [provider, setProvider] = useState<"astar" | "kakao">("astar");
  const [results, setResults] = useState<HospitalRecommendation[]>([]);
  const [dispatchStation, setDispatchStation] =
    useState<DispatchStation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [routingHospitalId, setRoutingHospitalId] = useState<number | null>(
    null,
  );
  const [activeRoute, setActiveRoute] = useState<EmergencyRouteResult | null>(
    null,
  );
  const scenario = useMemo(
    () => scenarioFor(patientType, symptom),
    [patientType, symptom],
  );

  async function recommend() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/emergency/recommendations", {
        body: JSON.stringify({ ...origin, incidentType, scenario }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as RecommendationResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "응급기관 추천에 실패했습니다.");
      }

      setDispatchStation(payload.dispatchStation);
      setResults(payload.hospitals);
      if (payload.hospitals.length === 0) {
        setError("조건을 충족하는 응급의료기관 데이터가 없습니다.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function routeTo(hospital: HospitalRecommendation) {
    setRoutingHospitalId(hospital.id);
    setError(null);

    try {
      const response = await fetch("/api/routing/route", {
        body: JSON.stringify({
          destination: {
            latitude: hospital.latitude,
            longitude: hospital.longitude,
          },
          origin,
          provider,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        route?: EmergencyRouteResult;
      };

      if (!response.ok || !payload.route) {
        throw new Error(payload.error ?? "이송 경로 계산에 실패했습니다.");
      }

      setActiveRoute(payload.route);
      onRoute(payload.route);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setRoutingHospitalId(null);
    }
  }

  return (
    <section
      aria-labelledby="emergency-routing-title"
      className={styles.emergencyPanel}
    >
      <header className={styles.emergencyPanelHeader}>
        <div>
          <span>도로 이동시간 기반</span>
          <h2 id="emergency-routing-title">응급 출동·이송 추천</h2>
        </div>
        <button
          aria-label="응급 이송 패널 닫기"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className={styles.emergencyTypeButtons}>
        <button
          aria-pressed={incidentType === "ambulance"}
          onClick={() => setIncidentType("ambulance")}
          type="button"
        >
          <Ambulance aria-hidden="true" size={17} /> 구급
        </button>
        <button
          aria-pressed={incidentType === "fire"}
          onClick={() => setIncidentType("fire")}
          type="button"
        >
          <Flame aria-hidden="true" size={17} /> 화재
        </button>
      </div>

      <div className={styles.emergencyFields}>
        <label>
          환자 유형
          <select
            onChange={(event) => setPatientType(event.target.value)}
            value={patientType}
          >
            <option value="none">미선택</option>
            <option value="infant">영유아·소아</option>
            <option value="adult">성인</option>
            <option value="elderly">고령자</option>
            <option value="pregnant">임산부</option>
          </select>
        </label>
        <label>
          증상·상태
          <select
            onChange={(event) => setSymptom(event.target.value)}
            value={symptom}
          >
            {SYMPTOMS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          경로 계산
          <select
            onChange={(event) =>
              setProvider(event.target.value === "kakao" ? "kakao" : "astar")
            }
            value={provider}
          >
            <option value="astar">자체 A* (OSM 도로망)</option>
            <option value="kakao">카카오맵 길찾기</option>
          </select>
        </label>
      </div>

      <p className={styles.emergencyOrigin}>
        사고 지점 {origin.latitude.toFixed(5)}, {origin.longitude.toFixed(5)}
      </p>
      <button
        className={styles.emergencyRecommendButton}
        disabled={isLoading}
        onClick={recommend}
        type="button"
      >
        {isLoading ? (
          <LoaderCircle
            aria-hidden="true"
            className={styles.spinner}
            size={17}
          />
        ) : (
          <Route aria-hidden="true" size={17} />
        )}
        {isLoading ? "후보와 도로시간 계산 중" : "추천 병원 계산"}
      </button>

      {dispatchStation ? (
        <p className={styles.dispatchStation}>
          출동 후보: {dispatchStation.name} ·{" "}
          {(dispatchStation.distanceMeters / 1000).toFixed(1)}km
        </p>
      ) : null}
      {error ? <p className={styles.emergencyError}>{error}</p> : null}
      {activeRoute ? (
        <p className={styles.emergencyRouteSummary}>
          {routeProviderLabel(activeRoute)} 경로 ·{" "}
          {minutes(activeRoute.durationSeconds)}분 ·{" "}
          {(activeRoute.distanceMeters / 1000).toFixed(1)}km
          {routeTrafficText(activeRoute) ? (
            <> · {routeTrafficText(activeRoute)}</>
          ) : null}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ol className={styles.hospitalResults}>
          {results.map((hospital) => (
            <li key={hospital.id}>
              <div className={styles.hospitalResultHeader}>
                <strong>{hospital.name}</strong>
                <b>{hospital.score.toFixed(1)}점</b>
              </div>
              <p>
                {hospital.category} · {minutes(hospital.durationSeconds)}분 ·{" "}
                {(hospital.distanceMeters / 1000).toFixed(1)}km
              </p>
              <small>{hospital.reasons.join(" · ")}</small>
              <button
                disabled={routingHospitalId !== null}
                onClick={() => routeTo(hospital)}
                type="button"
              >
                {routingHospitalId === hospital.id
                  ? "경로 계산 중"
                  : "이 병원으로 경로 보기"}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
