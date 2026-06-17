"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.scss";

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
  updatedAt: string | null;
  updateProgress: DatasetUpdateProgress | null;
};

export type DatasetUpdateProgress = {
  message: string;
  percent: number;
  source: DatasetSourceId;
  stage: string;
  status: "completed" | "failed" | "running";
  updatedAt: string;
};

export type DatasetImportProgress = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  mode: "restart" | "resume";
  nextIndex: number;
  reason: string | null;
  skippedCount: number;
  source: DatasetSourceId;
  startedAt: string;
  status: "paused" | "running";
  totalCount: number;
  updatedAt: string;
};

export type UpdateCooldown = {
  action: string;
  available: boolean;
  cooldownMs: number;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
};

export type ProgressState = {
  currentStep: string;
  percent: number;
  title: string;
};

export function formatDuration(value: number) {
  const totalSeconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function calculateCooldown(cooldown: UpdateCooldown | null | undefined) {
  if (!cooldown?.nextAvailableAt) {
    return cooldown ?? null;
  }

  const remainingMs = Math.max(
    0,
    new Date(cooldown.nextAvailableAt).getTime() - Date.now(),
  );

  return {
    ...cooldown,
    available: remainingMs === 0,
    remainingMs,
  };
}

export function actionUnavailableLabel(
  cooldown: UpdateCooldown | null,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!cooldown || cooldown.available) {
    return "";
  }

  return t("다시 가능: {duration}", {
    duration: formatDuration(cooldown.remainingMs),
  });
}

export async function parseUpdateError(
  response: Response,
  fallback: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const payload = (await response.json().catch(() => null)) as {
    cooldown?: UpdateCooldown;
    error?: string;
  } | null;

  if (response.status === 429 && payload?.cooldown) {
    return t(
      "5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.",
      { duration: formatDuration(payload.cooldown.remainingMs) },
    );
  }

  return payload?.error ?? fallback;
}

export async function requestDatasetUpdate(
  source: DatasetSourceId,
  importMode: "restart" | "resume",
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const response = await fetch(`/api/datasets/${source}/update`, {
    body: JSON.stringify({ mode: importMode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseUpdateError(response, t("업데이트 실패"), t));
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    paused?: boolean;
  } | null;

  return payload?.paused
    ? (payload.error ?? t("업데이트가 일시중단되었습니다."))
    : null;
}

type DatasetUpdateButtonProps = {
  dataset: DatasetStatus;
  isUpdating: boolean;
  activeUpdate: DatasetSourceId | "all" | undefined;
  cooldown: UpdateCooldown | null;
  onUpdate: (id: DatasetSourceId) => void;
  unavailableLabel: string;
};

export function DatasetUpdateButton({
  dataset,
  isUpdating,
  activeUpdate,
  cooldown,
  onUpdate,
  unavailableLabel,
}: DatasetUpdateButtonProps) {
  return (
    <button
      className={styles.actionButton}
      disabled={isUpdating || Boolean(cooldown && !cooldown.available)}
      key={dataset.id}
      onClick={() => onUpdate(dataset.id)}
      title={unavailableLabel}
      type="button"
    >
      {activeUpdate === dataset.id ? (
        <RefreshCw
          aria-hidden="true"
          className={styles.spinning}
          size={16}
          strokeWidth={2.4}
        />
      ) : null}
      {dataset.label}
      {cooldown && !cooldown.available ? (
        <span className={styles.buttonMeta}>
          {formatDuration(cooldown.remainingMs)}
        </span>
      ) : null}
    </button>
  );
}

type DatasetResumeGroupProps = {
  dataset: DatasetStatus;
  isUpdating: boolean;
  cooldown: UpdateCooldown | null;
  onUpdate: (id: DatasetSourceId, mode: "restart" | "resume") => void;
  unavailableLabel: string;
  dictionary: AppDictionary;
};

export function DatasetResumeGroup({
  dataset,
  isUpdating,
  cooldown,
  onUpdate,
  unavailableLabel,
  dictionary,
}: DatasetResumeGroupProps) {
  const t = (key: string) => uiText(dictionary, key);
  const disabled = isUpdating || Boolean(cooldown && !cooldown.available);

  return (
    <div className={styles.resumeGroup} key={`${dataset.id}-resume`}>
      <span>{dataset.label}</span>
      <button
        className={styles.actionButton}
        disabled={disabled}
        onClick={() => onUpdate(dataset.id, "restart")}
        title={unavailableLabel}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} strokeWidth={2.4} />
        {t("처음부터 다시 하기")}
      </button>
      <button
        className={styles.actionButton}
        disabled={disabled}
        onClick={() => onUpdate(dataset.id, "resume")}
        title={unavailableLabel}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} strokeWidth={2.4} />
        {t("이어서 하기")}
      </button>
    </div>
  );
}

type UpdateProgressModalProps = {
  progress: ProgressState;
  dictionary: AppDictionary;
  titleId: string;
};

export function UpdateProgressModal({
  progress,
  dictionary,
  titleId,
}: UpdateProgressModalProps) {
  return (
    <div className={styles.progressBackdrop} role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.progressModal}
        role="dialog"
      >
        <div className={styles.progressHeader}>
          <h2>{progress.title}</h2>
          <span>
            {uiText(dictionary, "format.percent", {
              value: progress.percent,
            })}
          </span>
        </div>
        <div
          aria-label={uiText(dictionary, "갱신 진행률")}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress.percent}
          className={styles.progressTrack}
          role="progressbar"
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <p>{progress.currentStep}</p>
      </section>
    </div>
  );
}

type DatasetUpdateConsoleViewProps = {
  dictionary: AppDictionary;
  datasets: DatasetStatus[];
  isUpdating: boolean;
  activeUpdate: DatasetSourceId | "all" | undefined;
  allDatasetCooldown: UpdateCooldown | null;
  datasetCooldown: (source: DatasetSourceId) => UpdateCooldown | null;
  pausedDatasets: DatasetStatus[];
  hazardsCooldown: UpdateCooldown | null;
  notice: string;
  visibleProgress: ProgressState | null;
  progressTitleId: string;
  onUpdateDataset: (
    source: DatasetSourceId | "all",
    updateMode?: "restart" | "resume",
  ) => void;
  onUpdateHazards: () => void;
};

export function DatasetUpdateConsoleView({
  dictionary,
  datasets,
  isUpdating,
  activeUpdate,
  allDatasetCooldown,
  datasetCooldown,
  pausedDatasets,
  hazardsCooldown,
  notice,
  visibleProgress,
  progressTitleId,
  onUpdateDataset,
  onUpdateHazards,
}: DatasetUpdateConsoleViewProps) {
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      uiText(dictionary, key, values),
    [dictionary],
  );

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{t("데이터 갱신")}</span>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.actionButton}
          disabled={isUpdating || Boolean(allDatasetCooldown)}
          onClick={() => onUpdateDataset("all")}
          title={actionUnavailableLabel(allDatasetCooldown, t)}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={activeUpdate === "all" ? styles.spinning : undefined}
            size={16}
            strokeWidth={2.4}
          />
          {t("전체")}
          {allDatasetCooldown ? (
            <span className={styles.buttonMeta}>
              {formatDuration(allDatasetCooldown.remainingMs)}
            </span>
          ) : null}
        </button>
        {datasets.map((dataset) => (
          <DatasetUpdateButton
            activeUpdate={activeUpdate}
            cooldown={datasetCooldown(dataset.id)}
            dataset={dataset}
            isUpdating={isUpdating}
            key={dataset.id}
            onUpdate={onUpdateDataset}
            unavailableLabel={actionUnavailableLabel(
              datasetCooldown(dataset.id),
              t,
            )}
          />
        ))}
        {pausedDatasets.map((dataset) => (
          <DatasetResumeGroup
            cooldown={datasetCooldown(dataset.id)}
            dataset={dataset}
            dictionary={dictionary}
            isUpdating={isUpdating}
            key={`${dataset.id}-resume`}
            onUpdate={onUpdateDataset}
            unavailableLabel={actionUnavailableLabel(
              datasetCooldown(dataset.id),
              t,
            )}
          />
        ))}
        <button
          className={styles.actionButton}
          disabled={
            isUpdating || Boolean(hazardsCooldown && !hazardsCooldown.available)
          }
          onClick={onUpdateHazards}
          title={actionUnavailableLabel(hazardsCooldown, t)}
          type="button"
        >
          <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.4} />
          {t("지진/지진해일")}
          {hazardsCooldown && !hazardsCooldown.available ? (
            <span className={styles.buttonMeta}>
              {formatDuration(hazardsCooldown.remainingMs)}
            </span>
          ) : null}
        </button>
      </div>
      {notice ? <output className={styles.notice}>{notice}</output> : null}

      {visibleProgress ? (
        <UpdateProgressModal
          dictionary={dictionary}
          progress={visibleProgress}
          titleId={progressTitleId}
        />
      ) : null}
    </section>
  );
}
