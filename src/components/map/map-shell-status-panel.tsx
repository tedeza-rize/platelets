"use client";

import { AlertTriangle, Database, MapPin } from "lucide-react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";
import datasetStyles from "./map-shell-dataset-panel.module.scss";

type DatasetPanelProps = {
  dataError: string | null;
  dictionary: AppDictionary;
  hazardsCount: number;
  isLoadingData: boolean;
  isLowPerformance: boolean;
  latestFetchedAt: string | null;
  mappedPointCount: number;
};

export function DatasetPanel({
  dataError,
  dictionary,
  hazardsCount,
  isLoadingData,
  isLowPerformance,
  latestFetchedAt,
  mappedPointCount,
}: DatasetPanelProps) {
  let notice = uiText(dictionary, "map.status.viewportLoaded");

  if (isLoadingData) {
    notice = dictionary.map.datasets.loading;
  }

  if (isLowPerformance) {
    notice = uiText(dictionary, "map.performance.lowFps");
  }

  if (dataError) {
    notice = dataError;
  }

  return (
    <section
      aria-label={dictionary.map.datasets.panelLabel}
      className={datasetStyles.datasetPanel}
    >
      <div className={datasetStyles.datasetStats}>
        <span className={datasetStyles.datasetMetric}>
          <MapPin aria-hidden="true" size={16} strokeWidth={2.4} />
          <span>{mappedPointCount.toLocaleString("ko-KR")}</span>
          <span>{dictionary.map.datasets.points}</span>
        </span>
        <span className={datasetStyles.datasetMetric}>
          <Database aria-hidden="true" size={16} strokeWidth={2.4} />
          <span>{dictionary.map.datasets.lastUpdated}</span>
          <span>
            {mapCore.formatDateTime(latestFetchedAt) ??
              dictionary.map.datasets.neverUpdated}
          </span>
        </span>
        <span className={datasetStyles.datasetMetric}>
          <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.4} />
          <span>{hazardsCount.toLocaleString("ko-KR")}</span>
          <span>{uiText(dictionary, "map.status.recentEvents")}</span>
        </span>
      </div>

      <output className={datasetStyles.dataNotice}>{notice}</output>
    </section>
  );
}
