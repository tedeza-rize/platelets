"use client";

import type {
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup,
} from "maplibre-gl";
import type { Dispatch, SetStateAction } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";

type MutableRef<T> = {
  current: T;
};

type MapLibreModule = typeof import("maplibre-gl");

type ReverseGeocodeResponse = {
  addresses?: string[];
  errorCode?: string;
};

export type MapClickOptions = {
  dictionary: AppDictionary;
  focusHazard: (event: mapCore.HazardEvent) => void;
  hazardsRef: MutableRef<mapCore.HazardEvent[]>;
  popupClassNames: mapCore.PopupClassNames;
  popupRef: MutableRef<Popup | null>;
  setSeoulAreas: Dispatch<SetStateAction<mapCore.SeoulAreasData | null>>;
  sourceLabelsRef: MutableRef<Map<DatasetSourceId, string>>;
};

async function showPointPopup(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  feature: MapGeoJSONFeature,
  options: MapClickOptions,
) {
  if (!feature?.properties) {
    return;
  }

  const point = feature.properties as mapCore.PointFeatureProperties;
  const coordinates: [number, number] = [
    Number(point.longitude),
    Number(point.latitude),
  ];

  if (!(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))) {
    return;
  }

  const response = await fetch(`/api/points/${point.id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const fallbackPoint: mapCore.EmergencyPointDetail = {
      address: uiText(options.dictionary, "map.popup.addressLoading"),
      category: point.category,
      fetchedAt: null,
      id: point.id,
      latitude: coordinates[1],
      longitude: coordinates[0],
      name: uiText(options.dictionary, "map.popup.selectedPoint"),
      parentName: null,
      phone: null,
      source: point.source,
      sourceRecordId: String(point.id),
      sourceUpdatedAt: null,
    };

    options.popupRef.current?.remove();
    options.popupRef.current = new maplibre.Popup({
      closeButton: true,
      maxWidth: "320px",
      offset: 16,
    })
      .setLngLat(coordinates)
      .setHTML(
        mapCore.buildPopupHtml(
          fallbackPoint,
          options.dictionary,
          options.sourceLabelsRef.current.get(point.source) ?? point.source,
          options.popupClassNames,
        ),
      )
      .addTo(map);
    return;
  }

  const payload = (await response.json()) as mapCore.PointDetailResponse;
  options.popupRef.current?.remove();
  options.popupRef.current = new maplibre.Popup({
    closeButton: true,
    maxWidth: "320px",
    offset: 16,
  })
    .setLngLat(coordinates)
    .setHTML(
      mapCore.buildPopupHtml(
        payload.point,
        options.dictionary,
        options.sourceLabelsRef.current.get(payload.point.source) ??
          payload.point.source,
        options.popupClassNames,
      ),
    )
    .addTo(map);
}

async function showSeoulPopulationPopup(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  feature: MapGeoJSONFeature,
  options: MapClickOptions,
) {
  if (!feature?.properties) {
    return;
  }

  const area = feature.properties as mapCore.SeoulAreaProperties;
  const point = feature.properties as mapCore.SeoulAreaPointProperties;
  const coordinates: [number, number] = [
    Number(point.longitude),
    Number(point.latitude),
  ];

  if (!(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))) {
    return;
  }

  const response = await fetch(
    `/api/seoul/population?areaCode=${encodeURIComponent(area.areaCode)}`,
    { cache: "no-store" },
  );
  const payload = (await response
    .json()
    .catch(() => ({}))) as mapCore.SeoulPopulationResponse;
  const population = response.ok ? (payload.population ?? null) : null;
  let errorMessage: string | null = null;

  if (!population) {
    errorMessage = payload.errorKey
      ? uiText(options.dictionary, payload.errorKey)
      : (payload.error ?? uiText(options.dictionary, "실시간 인구 조회 실패"));
  }

  if (population) {
    options.setSeoulAreas((current) =>
      current
        ? mapCore.updateSeoulAreaPopulation(current, population)
        : current,
    );
  }

  options.popupRef.current?.remove();
  options.popupRef.current = new maplibre.Popup({
    closeButton: true,
    maxWidth: "340px",
    offset: 12,
  })
    .setLngLat(coordinates)
    .setHTML(
      mapCore.buildSeoulPopulationPopupHtml(
        area,
        population,
        errorMessage,
        options.dictionary,
        options.popupClassNames,
      ),
    )
    .addTo(map);
}

async function showLocationPopup(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  event: MapLayerMouseEvent,
  options: MapClickOptions,
) {
  const latitude = event.lngLat.lat;
  const longitude = event.lngLat.lng;
  const coordinates: [number, number] = [longitude, latitude];

  options.popupRef.current?.remove();
  options.popupRef.current = new maplibre.Popup({
    closeButton: true,
    maxWidth: "320px",
    offset: 12,
  })
    .setLngLat(coordinates)
    .setHTML(
      mapCore.buildLocationPopupHtml(
        { address: null, latitude, longitude, status: "loading" },
        options.dictionary,
        options.popupClassNames,
      ),
    )
    .addTo(map);

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const response = await fetch(`/api/geocoding/reverse?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as ReverseGeocodeResponse;
  const address = response.ok ? (payload.addresses?.[0] ?? null) : null;

  options.popupRef.current?.setHTML(
    mapCore.buildLocationPopupHtml(
      {
        address,
        latitude,
        longitude,
        status: address ? "found" : "unavailable",
      },
      options.dictionary,
      options.popupClassNames,
    ),
  );
}

export async function handleMapClick(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  event: MapLayerMouseEvent,
  options: MapClickOptions,
) {
  const layers = [
    mapCore.POINTS_SYMBOL_LAYER_ID,
    mapCore.POINTS_LAYER_ID,
    mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID,
    mapCore.SEOUL_AREAS_LAYER_ID,
    mapCore.SEOUL_AREAS_HALO_LAYER_ID,
    mapCore.HAZARDS_LAYER_ID,
  ].filter((layerId) => map.getLayer(layerId));

  if (layers.length === 0) {
    await showLocationPopup(maplibre, map, event, options);
    return;
  }

  const hitBox: [[number, number], [number, number]] = [
    [event.point.x - 10, event.point.y - 10],
    [event.point.x + 10, event.point.y + 10],
  ];
  const feature = map.queryRenderedFeatures(hitBox, { layers })[0] as
    | MapGeoJSONFeature
    | undefined;

  if (!feature?.properties) {
    await showLocationPopup(maplibre, map, event, options);
    return;
  }

  if (
    feature.layer.id === mapCore.POINTS_LAYER_ID ||
    feature.layer.id === mapCore.POINTS_SYMBOL_LAYER_ID
  ) {
    await showPointPopup(maplibre, map, feature, options);
    return;
  }

  if (
    feature.layer.id === mapCore.SEOUL_AREAS_HALO_LAYER_ID ||
    feature.layer.id === mapCore.SEOUL_AREAS_LAYER_ID ||
    feature.layer.id === mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID
  ) {
    await showSeoulPopulationPopup(maplibre, map, feature, options);
    return;
  }

  const eventId = String(
    (feature.properties as mapCore.HazardFeatureProperties).eventId,
  );
  const hazard = options.hazardsRef.current.find(
    (current) => current.eventId === eventId,
  );

  if (hazard) {
    options.focusHazard(hazard);
  }
}
