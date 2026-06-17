"use client";

import { Ambulance, Flame, LoaderCircle, Route, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./emergency-routing-panel.module.scss";

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

function routeProviderLabel(
  route: EmergencyRouteResult,
  t: (key: string) => string,
) {
  if (route.provider === "kakao") {
    return route.traffic?.status === "live"
      ? t("카카오 교통 반영")
      : t("카카오맵");
  }

  return route.traffic?.status === "live"
    ? t("자체 A* + ITS 교통")
    : t("자체 A*");
}

function routeTrafficText(
  route: EmergencyRouteResult,
  t: (key: string) => string,
) {
  if (!route.traffic) {
    return null;
  }

  if (route.traffic.status === "unconfigured") {
    return t("ITS 교통 API 키 미설정");
  }

  return route.traffic.message;
}

export function EmergencyRoutingPanel({
  dictionary,
  onClose,
  onRoute,
  origin,
}: {
  dictionary: AppDictionary;
  onClose: () => void;
  onRoute: (route: EmergencyRouteResult) => void;
  origin: Coordinate;
}) {
  const titleId = useId();
  const t = (key: string) => uiText(dictionary, key);
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
        throw new Error(
          response.status === 429
            ? t("Too many requests. Wait a moment before retrying.")
            : (payload.error ?? t("응급기관 추천에 실패했습니다.")),
        );
      }

      setDispatchStation(payload.dispatchStation);
      setResults(payload.hospitals);
      if (payload.hospitals.length === 0) {
        setError(t("조건을 충족하는 응급의료기관 데이터가 없습니다."));
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

      if (!(response.ok && payload.route)) {
        throw new Error(
          response.status === 429
            ? t("Too many requests. Wait a moment before retrying.")
            : (payload.error ?? t("이송 경로 계산에 실패했습니다.")),
        );
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
    <section aria-labelledby={titleId} className={styles.emergencyPanel}>
      <header className={styles.emergencyPanelHeader}>
        <div>
          <span>{t("도로 이동시간 기반")}</span>
          <h2 id={titleId}>{t("응급 출동·이송 추천")}</h2>
        </div>
        <button
          aria-label={t("응급 이송 패널 닫기")}
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
          <Ambulance aria-hidden="true" size={17} /> {t("구급")}
        </button>
        <button
          aria-pressed={incidentType === "fire"}
          onClick={() => setIncidentType("fire")}
          type="button"
        >
          <Flame aria-hidden="true" size={17} /> {t("화재")}
        </button>
      </div>

      <div className={styles.emergencyFields}>
        <label>
          {t("환자 유형")}
          <select
            onChange={(event) => setPatientType(event.target.value)}
            value={patientType}
          >
            <option value="none">{t("미선택")}</option>
            <option value="infant">{t("영유아·소아")}</option>
            <option value="adult">{t("성인")}</option>
            <option value="elderly">{t("고령자")}</option>
            <option value="pregnant">{t("임산부")}</option>
          </select>
        </label>
        <label>
          {t("증상·상태")}
          <select
            onChange={(event) => setSymptom(event.target.value)}
            value={symptom}
          >
            {SYMPTOMS.map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("경로 계산")}
          <select
            onChange={(event) =>
              setProvider(event.target.value === "kakao" ? "kakao" : "astar")
            }
            value={provider}
          >
            <option value="astar">{t("자체 A* (OSM 도로망)")}</option>
            <option value="kakao">{t("카카오맵 길찾기")}</option>
          </select>
        </label>
      </div>

      <p className={styles.emergencyOrigin}>
        {uiText(dictionary, "format.origin", {
          label: t("사고 지점"),
          latitude: origin.latitude.toFixed(5),
          longitude: origin.longitude.toFixed(5),
        })}
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
        {isLoading ? t("후보와 도로시간 계산 중") : t("추천 병원 계산")}
      </button>

      {dispatchStation ? (
        <p className={styles.dispatchStation}>
          {uiText(dictionary, "format.dispatchCandidate", {
            distance: (dispatchStation.distanceMeters / 1000).toFixed(1),
            name: dispatchStation.name,
          })}
        </p>
      ) : null}
      {error ? <p className={styles.emergencyError}>{error}</p> : null}
      {activeRoute ? (
        <p className={styles.emergencyRouteSummary}>
          {uiText(dictionary, "format.routeSummary", {
            distance: (activeRoute.distanceMeters / 1000).toFixed(1),
            minutes: minutes(activeRoute.durationSeconds),
            provider: routeProviderLabel(activeRoute, t),
            traffic: routeTrafficText(activeRoute, t)
              ? uiText(dictionary, "format.trafficSuffix", {
                  traffic: routeTrafficText(activeRoute, t) ?? "",
                })
              : "",
          })}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ol className={styles.hospitalResults}>
          {results.map((hospital) => (
            <li key={hospital.id}>
              <div className={styles.hospitalResultHeader}>
                <strong>{hospital.name}</strong>
                <b>
                  {hospital.score.toFixed(1)}
                  {t("점")}
                </b>
              </div>
              <p>
                {uiText(dictionary, "format.hospitalSummary", {
                  category: hospital.category,
                  distance: (hospital.distanceMeters / 1000).toFixed(1),
                  minutes: minutes(hospital.durationSeconds),
                })}
              </p>
              <small>{hospital.reasons.join(" · ")}</small>
              <button
                disabled={routingHospitalId !== null}
                onClick={() => routeTo(hospital)}
                type="button"
              >
                {routingHospitalId === hospital.id
                  ? t("경로 계산 중")
                  : t("이 병원으로 경로 보기")}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
