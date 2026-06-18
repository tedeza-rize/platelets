"use client";

import { Ambulance, Box } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import type * as mapCore from "@/lib/map-shell-core";
import {
  type EmergencyRouteResult,
  EmergencyRoutingPanel,
} from "./emergency-routing-panel";
import styles from "./map-shell.module.scss";
import {
  HazardModal,
  MapNavbar,
  MobileMapTools,
  MobileNav,
  SourceMenu,
} from "./map-shell-controls";
import { DatasetPanel } from "./map-shell-status-panel";

type MapShellViewProps = {
  activeHazard: mapCore.HazardEvent | null;
  activeHazardImageUrl: string | null;
  autoFocusHazards: boolean;
  dataError: string | null;
  datasets: mapCore.DatasetStatus[];
  dictionary: AppDictionary;
  emergencyOrigin: { latitude: number; longitude: number };
  filteredDatasets: mapCore.DatasetStatus[];
  hazardsCount: number;
  isEmergencyPanelOpen: boolean;
  isLoadingData: boolean;
  isLowPerformance: boolean;
  isMenuOpen: boolean;
  isSourceMenuOpen: boolean;
  isThreeDimensional: boolean;
  latestFetchedAt: string | null;
  mappedPointCount: number;
  mapContainerRef: RefObject<HTMLDivElement | null>;
  mobileProviderMenuRef: RefObject<HTMLDivElement | null>;
  onOpenEmergencyPanel: () => void;
  onOpenSourceSearch: () => void;
  provider: mapCore.MapProvider;
  providerMenuRef: RefObject<HTMLDivElement | null>;
  selectedDatasetCount: number;
  selectedDimensionLabel: string;
  selectedProviderLabel: string;
  setActiveHazard: Dispatch<SetStateAction<mapCore.HazardEvent | null>>;
  setAutoFocusHazards: Dispatch<SetStateAction<boolean>>;
  setEmergencyRoute: Dispatch<SetStateAction<EmergencyRouteResult | null>>;
  setIsEmergencyPanelOpen: Dispatch<SetStateAction<boolean>>;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
  setIsSourceMenuOpen: Dispatch<SetStateAction<boolean>>;
  setIsThreeDimensional: Dispatch<SetStateAction<boolean>>;
  setProvider: Dispatch<SetStateAction<mapCore.MapProvider>>;
  setSourceQuery: Dispatch<SetStateAction<string>>;
  setVisibleSources: Dispatch<
    SetStateAction<Partial<Record<DatasetSourceId, boolean>>>
  >;
  sourceMenuRef: RefObject<HTMLDivElement | null>;
  sourcePointCounts: Map<DatasetSourceId, number>;
  sourceQuery: string;
  sourceSearchInputRef: RefObject<HTMLInputElement | null>;
  visibleSources: Partial<Record<DatasetSourceId, boolean>>;
};

export function MapShellView({
  activeHazard,
  activeHazardImageUrl,
  autoFocusHazards,
  dataError,
  datasets,
  dictionary,
  emergencyOrigin,
  filteredDatasets,
  hazardsCount,
  isEmergencyPanelOpen,
  isLoadingData,
  isLowPerformance,
  isMenuOpen,
  isSourceMenuOpen,
  isThreeDimensional,
  latestFetchedAt,
  mappedPointCount,
  mapContainerRef,
  mobileProviderMenuRef,
  onOpenEmergencyPanel,
  onOpenSourceSearch,
  provider,
  providerMenuRef,
  selectedDatasetCount,
  selectedDimensionLabel,
  selectedProviderLabel,
  setActiveHazard,
  setAutoFocusHazards,
  setEmergencyRoute,
  setIsEmergencyPanelOpen,
  setIsMenuOpen,
  setIsSourceMenuOpen,
  setIsThreeDimensional,
  setProvider,
  setSourceQuery,
  setVisibleSources,
  sourceMenuRef,
  sourcePointCounts,
  sourceQuery,
  sourceSearchInputRef,
  visibleSources,
}: MapShellViewProps) {
  return (
    <div className={styles.page}>
      <MapNavbar
        dictionary={dictionary}
        isMenuOpen={isMenuOpen}
        onOpenSourceSearch={onOpenSourceSearch}
        provider={provider}
        providerMenuRef={providerMenuRef}
        selectedProviderLabel={selectedProviderLabel}
        setIsMenuOpen={setIsMenuOpen}
        setProvider={setProvider}
      />
      <main className={styles.main}>
        <div
          aria-label={dictionary.map.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
        <button
          aria-label={dictionary.map.dimensionButtonLabel.replace(
            "{dimension}",
            selectedDimensionLabel,
          )}
          aria-pressed={isThreeDimensional}
          className={
            isThreeDimensional
              ? styles.dimensionButtonActive
              : styles.dimensionButton
          }
          onClick={() => setIsThreeDimensional((current) => !current)}
          title={selectedDimensionLabel}
          type="button"
        >
          <Box aria-hidden="true" size={15} strokeWidth={2.5} />
          <span>{selectedDimensionLabel}</span>
        </button>
        <button
          className={styles.emergencyLauncher}
          onClick={onOpenEmergencyPanel}
          type="button"
        >
          <Ambulance aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>{uiText(dictionary, "응급 출동·이송")}</span>
        </button>
        {isEmergencyPanelOpen ? (
          <EmergencyRoutingPanel
            dictionary={dictionary}
            onClose={() => setIsEmergencyPanelOpen(false)}
            onRoute={setEmergencyRoute}
            origin={emergencyOrigin}
          />
        ) : null}
        <SourceMenu
          autoFocusHazards={autoFocusHazards}
          datasetsLength={datasets.length}
          dictionary={dictionary}
          filteredDatasets={filteredDatasets}
          isOpen={isSourceMenuOpen}
          selectedDatasetCount={selectedDatasetCount}
          setAutoFocusHazards={setAutoFocusHazards}
          setIsOpen={setIsSourceMenuOpen}
          setSourceQuery={setSourceQuery}
          setVisibleSources={setVisibleSources}
          sourceMenuRef={sourceMenuRef}
          sourcePointCounts={sourcePointCounts}
          sourceQuery={sourceQuery}
          sourceSearchInputRef={sourceSearchInputRef}
          visibleSources={visibleSources}
        />
        <MobileMapTools
          dictionary={dictionary}
          isMenuOpen={isMenuOpen}
          mobileProviderMenuRef={mobileProviderMenuRef}
          provider={provider}
          selectedProviderLabel={selectedProviderLabel}
          setIsMenuOpen={setIsMenuOpen}
          setProvider={setProvider}
        />
        <DatasetPanel
          dataError={dataError}
          dictionary={dictionary}
          hazardsCount={hazardsCount}
          isLoadingData={isLoadingData}
          isLowPerformance={isLowPerformance}
          latestFetchedAt={latestFetchedAt}
          mappedPointCount={mappedPointCount}
        />
        {activeHazard ? (
          <HazardModal
            activeHazard={activeHazard}
            activeHazardImageUrl={activeHazardImageUrl}
            dictionary={dictionary}
            onClose={() => setActiveHazard(null)}
          />
        ) : null}
      </main>
      <MobileNav
        dictionary={dictionary}
        onOpenSourceSearch={onOpenSourceSearch}
      />
    </div>
  );
}
