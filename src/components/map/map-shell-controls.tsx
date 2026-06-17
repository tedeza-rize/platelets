"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database,
  HeartPulse,
  ListFilter,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useId,
} from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";
import styles from "./map-shell-controls.module.scss";
import datasetStyles from "./map-shell-dataset-panel.module.scss";
import hazardStyles from "./map-shell-hazard-modal.module.scss";

type ProviderControlProps = {
  dictionary: AppDictionary;
  isMenuOpen: boolean;
  provider: mapCore.MapProvider;
  selectedProviderLabel: string;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
  setProvider: Dispatch<SetStateAction<mapCore.MapProvider>>;
};

type ProviderButtonProps = ProviderControlProps & {
  dropdownClassName: string;
  menuRef?: RefObject<HTMLDivElement | null>;
  toolButton?: boolean;
};

type SourceMenuProps = {
  autoFocusHazards: boolean;
  datasetsLength: number;
  dictionary: AppDictionary;
  filteredDatasets: mapCore.DatasetStatus[];
  isOpen: boolean;
  selectedDatasetCount: number;
  setAutoFocusHazards: Dispatch<SetStateAction<boolean>>;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
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

type DatasetPanelProps = {
  dataError: string | null;
  dictionary: AppDictionary;
  hazardsCount: number;
  isLoadingData: boolean;
  latestFetchedAt: string | null;
  mappedPointCount: number;
};

type HazardModalProps = {
  activeHazard: mapCore.HazardEvent;
  activeHazardImageUrl: string | null;
  dictionary: AppDictionary;
  onClose: () => void;
};

export function MapNavbar({
  dictionary,
  isMenuOpen,
  provider,
  providerMenuRef,
  selectedProviderLabel,
  setIsMenuOpen,
  setProvider,
  onOpenSourceSearch,
}: ProviderControlProps & {
  onOpenSourceSearch: () => void;
  providerMenuRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <nav className={styles.navbar} aria-label={dictionary.navigation.label}>
      <a className={styles.brandLink} href="/">
        <span className={styles.brandMark}>
          <HeartPulse aria-hidden="true" size={20} strokeWidth={2.7} />
        </span>
        <span>{dictionary.navigation.brand}</span>
      </a>
      <div className={styles.desktopLinks}>
        <a className={styles.desktopLinkActive} href="/">
          {uiText(dictionary, "지도")}
        </a>
        <a className={styles.desktopLink} href="/ai">
          {uiText(dictionary, "AI 분석")}
        </a>
        <a className={styles.desktopLink} href="/admin">
          {uiText(dictionary, "관리자")}
        </a>
      </div>
      <div className={styles.navActions}>
        <button
          className={styles.navSearchButton}
          onClick={onOpenSourceSearch}
          type="button"
        >
          <Search aria-hidden="true" size={18} strokeWidth={2.2} />
          <span>{uiText(dictionary, "시설 검색")}</span>
        </button>
        <a
          aria-label={uiText(dictionary, "데이터 출처 및 라이선스")}
          className={styles.navIconLink}
          href="/licenses"
          title={uiText(dictionary, "데이터 출처 및 라이선스")}
        >
          <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.5} />
        </a>
        <ProviderButton
          dictionary={dictionary}
          dropdownClassName={styles.providerDropdown}
          isMenuOpen={isMenuOpen}
          menuRef={providerMenuRef}
          provider={provider}
          selectedProviderLabel={selectedProviderLabel}
          setIsMenuOpen={setIsMenuOpen}
          setProvider={setProvider}
        />
      </div>
    </nav>
  );
}

export function MobileMapTools({
  mobileProviderMenuRef,
  ...providerProps
}: ProviderControlProps & {
  mobileProviderMenuRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={styles.mobileMapTools} ref={mobileProviderMenuRef}>
      <a
        aria-label={uiText(providerProps.dictionary, "데이터 출처 및 라이선스")}
        className={styles.mobileToolButton}
        href="/licenses"
        title={uiText(providerProps.dictionary, "데이터 출처 및 라이선스")}
      >
        <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.5} />
      </a>
      <ProviderButton
        {...providerProps}
        dropdownClassName={styles.mobileProviderDropdown}
        toolButton
      />
    </div>
  );
}

export function SourceMenu({
  autoFocusHazards,
  datasetsLength,
  dictionary,
  filteredDatasets,
  isOpen,
  selectedDatasetCount,
  setAutoFocusHazards,
  setIsOpen,
  setSourceQuery,
  setVisibleSources,
  sourceMenuRef,
  sourcePointCounts,
  sourceQuery,
  sourceSearchInputRef,
  visibleSources,
}: SourceMenuProps) {
  return (
    <div className={styles.sourceMenu} ref={sourceMenuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={dictionary.map.datasets.sourceMenuLabel}
        className={styles.sourceMenuButton}
        onClick={() => setIsOpen((current) => !current)}
        title={dictionary.map.datasets.sourceMenuLabel}
        type="button"
      >
        <ListFilter aria-hidden="true" size={18} strokeWidth={2.5} />
        <span>
          {uiText(dictionary, "format.datasetCount", {
            selected: selectedDatasetCount.toLocaleString(
              dictionary.formatLocale,
            ),
            total: datasetsLength.toLocaleString(dictionary.formatLocale),
          })}
        </span>
      </button>
      {isOpen ? (
        <fieldset className={styles.sourceDropdown}>
          <legend className={styles.sourceLegend}>
            {dictionary.map.datasets.sourceMenuTitle}
          </legend>
          <label className={styles.sourceSearch}>
            <Search aria-hidden="true" size={15} strokeWidth={2.4} />
            <span>{uiText(dictionary, "표시 항목 검색")}</span>
            <input
              onChange={(event) => setSourceQuery(event.target.value)}
              placeholder={uiText(dictionary, "검색")}
              ref={sourceSearchInputRef}
              type="search"
              value={sourceQuery}
            />
          </label>
          <div className={styles.sourceList}>
            {filteredDatasets.map((dataset) => (
              <label className={styles.sourceItem} key={dataset.id}>
                <input
                  checked={mapCore.isSourceVisible(visibleSources, dataset.id)}
                  onChange={() =>
                    setVisibleSources((current) => ({
                      ...current,
                      [dataset.id]: !mapCore.isSourceVisible(
                        current,
                        dataset.id,
                      ),
                    }))
                  }
                  type="checkbox"
                />
                <span>{dataset.label}</span>
                <small>
                  {(
                    dataset.geocodedCount ||
                    sourcePointCounts.get(dataset.id) ||
                    0
                  ).toLocaleString("ko-KR")}
                </small>
              </label>
            ))}
            {filteredDatasets.length === 0 ? (
              <p className={styles.sourceEmpty}>
                {uiText(dictionary, "검색 결과가 없습니다.")}
              </p>
            ) : null}
          </div>
          <label className={styles.settingItem}>
            <input
              checked={autoFocusHazards}
              onChange={(event) => setAutoFocusHazards(event.target.checked)}
              type="checkbox"
            />
            <Settings aria-hidden="true" size={15} strokeWidth={2.4} />
            <span>{uiText(dictionary, "이벤트 발생 시 지도 이동")}</span>
          </label>
        </fieldset>
      ) : null}
    </div>
  );
}

export function DatasetPanel({
  dataError,
  dictionary,
  hazardsCount,
  isLoadingData,
  latestFetchedAt,
  mappedPointCount,
}: DatasetPanelProps) {
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
          <span>{uiText(dictionary, "최근 이벤트")}</span>
        </span>
      </div>

      {isLoadingData || dataError ? (
        <output className={datasetStyles.dataNotice}>
          {dataError ?? dictionary.map.datasets.loading}
        </output>
      ) : null}
    </section>
  );
}

export function HazardModal({
  activeHazard,
  activeHazardImageUrl,
  dictionary,
  onClose,
}: HazardModalProps) {
  const titleId = useId();
  return (
    <div className={hazardStyles.modalBackdrop} role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={hazardStyles.hazardModal}
        role="dialog"
      >
        <div className={hazardStyles.hazardHeader}>
          <div>
            <span>
              {mapCore.hazardTypeLabel(activeHazard.eventType, dictionary)}
            </span>
            <h2 id={titleId}>{activeHazard.title}</h2>
          </div>
          <button
            aria-label={uiText(dictionary, "이벤트 정보 닫기")}
            className={hazardStyles.modalCloseButton}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <dl className={hazardStyles.hazardDetails}>
          <div>
            <dt>{uiText(dictionary, "통보 시각")}</dt>
            <dd>{mapCore.formatDateTime(activeHazard.issuedAt) ?? "-"}</dd>
          </div>
          <div>
            <dt>{uiText(dictionary, "발생 시각")}</dt>
            <dd>{mapCore.formatDateTime(activeHazard.occurredAt) ?? "-"}</dd>
          </div>
          <div>
            <dt>{uiText(dictionary, "위치")}</dt>
            <dd>{activeHazard.location}</dd>
          </div>
          <div>
            <dt>{uiText(dictionary, "규모")}</dt>
            <dd>{activeHazard.magnitude ?? "-"}</dd>
          </div>
          <div>
            <dt>{uiText(dictionary, "진도/지역")}</dt>
            <dd>{activeHazard.intensity ?? "-"}</dd>
          </div>
          <div>
            <dt>{uiText(dictionary, "깊이")}</dt>
            <dd>{activeHazard.depth ?? "-"}</dd>
          </div>
        </dl>
        {activeHazard.description ? (
          <p className={hazardStyles.hazardDescription}>
            {activeHazard.description}
          </p>
        ) : null}
        {activeHazardImageUrl ? (
          <figure className={hazardStyles.hazardImageFrame}>
            <Image
              alt={`${activeHazard.title} ${uiText(dictionary, "기상청 관측 이미지")}`}
              className={hazardStyles.hazardImage}
              height={800}
              loading="lazy"
              src={activeHazardImageUrl}
              unoptimized
              width={1200}
            />
            <figcaption>{uiText(dictionary, "기상청 제공 이미지")}</figcaption>
          </figure>
        ) : null}
      </section>
    </div>
  );
}

export function MobileNav({
  dictionary,
  onOpenSourceSearch,
}: {
  dictionary: AppDictionary;
  onOpenSourceSearch: () => void;
}) {
  return (
    <nav
      className={styles.mobileNav}
      aria-label={uiText(dictionary, "모바일 주요 탐색")}
    >
      <a className={styles.mobileNavActive} href="/">
        <MapIcon aria-hidden="true" size={20} strokeWidth={2.5} />
        <span>{uiText(dictionary, "지도")}</span>
      </a>
      <button onClick={onOpenSourceSearch} type="button">
        <Search aria-hidden="true" size={20} strokeWidth={2.5} />
        <span>{uiText(dictionary, "시설")}</span>
      </button>
      <a href="/ai">
        <Sparkles aria-hidden="true" size={20} strokeWidth={2.5} />
        <span>{uiText(dictionary, "AI")}</span>
      </a>
      <a href="/admin">
        <UserCog aria-hidden="true" size={20} strokeWidth={2.5} />
        <span>{uiText(dictionary, "관리")}</span>
      </a>
    </nav>
  );
}

function ProviderButton({
  dictionary,
  dropdownClassName,
  isMenuOpen,
  menuRef,
  provider,
  selectedProviderLabel,
  setIsMenuOpen,
  setProvider,
  toolButton = false,
}: ProviderButtonProps) {
  const selectedProviderConfig = mapCore.PROVIDERS[provider];
  const SelectedProviderIcon = selectedProviderConfig.icon as LucideIcon;

  return (
    <div className={toolButton ? undefined : styles.providerMenu} ref={menuRef}>
      <button
        aria-expanded={isMenuOpen}
        aria-haspopup={toolButton ? undefined : "menu"}
        aria-label={dictionary.map.providerMenuLabel.replace(
          "{provider}",
          selectedProviderLabel,
        )}
        className={toolButton ? styles.mobileToolButton : styles.providerButton}
        onClick={() => setIsMenuOpen((current) => !current)}
        title={selectedProviderLabel}
        type="button"
      >
        <SelectedProviderIcon aria-hidden="true" size={18} strokeWidth={2.5} />
        {toolButton ? null : (
          <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
        )}
      </button>
      {isMenuOpen ? (
        <div className={dropdownClassName} role="menu">
          {(Object.keys(mapCore.PROVIDERS) as mapCore.MapProvider[]).map(
            (providerKey) => {
              const providerConfig = mapCore.PROVIDERS[providerKey];
              const Icon = providerConfig.icon as LucideIcon;
              const providerLabel =
                dictionary.map.providers[providerConfig.labelKey];

              return (
                <button
                  aria-checked={provider === providerKey}
                  className={styles.providerItem}
                  key={providerKey}
                  onClick={() => {
                    setProvider(providerKey);
                    setIsMenuOpen(false);
                  }}
                  role="menuitemradio"
                  type="button"
                >
                  <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
                  <span>{providerLabel}</span>
                  {provider === providerKey ? (
                    <Check aria-hidden="true" size={15} strokeWidth={2.6} />
                  ) : null}
                </button>
              );
            },
          )}
        </div>
      ) : null}
    </div>
  );
}
