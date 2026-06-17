"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  calculateCooldown,
  type DatasetStatus,
  DatasetUpdateConsoleView,
  formatDuration,
  type ProgressState,
  parseUpdateError,
  requestDatasetUpdate,
  type UpdateCooldown,
} from "@/components/admin/dataset-update-helpers";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";

async function performDatasetUpdate({
  source,
  updateMode = "restart",
  datasets,
  datasetCooldown,
  ensureSudoSession,
  t,
  setActiveUpdate,
  setNotice,
  setActiveDatasetSource,
  refreshStatus,
}: {
  source: DatasetSourceId | "all";
  updateMode?: "restart" | "resume";
  datasets: DatasetStatus[];
  datasetCooldown: (source: DatasetSourceId) => UpdateCooldown | null;
  ensureSudoSession: () => Promise<void>;
  t: (key: string, values?: Record<string, string | number>) => string;
  setActiveUpdate: React.Dispatch<
    React.SetStateAction<DatasetSourceId | "all" | undefined>
  >;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  setActiveDatasetSource: React.Dispatch<
    React.SetStateAction<DatasetSourceId | undefined>
  >;
  refreshStatus: () => Promise<void>;
}) {
  const blockedCooldown =
    source === "all"
      ? datasets
          .map((dataset) => datasetCooldown(dataset.id))
          .find((cooldown) => cooldown && !cooldown.available)
      : datasetCooldown(source);

  if (blockedCooldown && !blockedCooldown.available) {
    setNotice(
      t("5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.", {
        duration: formatDuration(blockedCooldown.remainingMs),
      }),
    );
    return;
  }

  setActiveUpdate(source);
  setNotice(t("업데이트 중"));

  try {
    await ensureSudoSession();
    let pausedMessage: string | null = null;

    if (source === "all") {
      for (const dataset of datasets) {
        setActiveDatasetSource(dataset.id);
        pausedMessage = await requestDatasetUpdate(dataset.id, "restart", t);

        if (pausedMessage) {
          break;
        }
      }
    } else {
      setActiveDatasetSource(source);
      pausedMessage = await requestDatasetUpdate(source, updateMode, t);
    }

    await refreshStatus();
    setNotice(pausedMessage ?? t("업데이트 완료"));
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error));
  } finally {
    setActiveUpdate(undefined);
    setActiveDatasetSource(undefined);
  }
}

async function performHazardsUpdate({
  getCooldown,
  ensureSudoSession,
  t,
  setNotice,
  setProgress,
  refreshStatus,
}: {
  getCooldown: (action: string) => UpdateCooldown | null;
  ensureSudoSession: () => Promise<void>;
  t: (key: string, values?: Record<string, string | number>) => string;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  setProgress: React.Dispatch<React.SetStateAction<ProgressState | null>>;
  refreshStatus: () => Promise<void>;
}) {
  const blockedCooldown = getCooldown("hazards");

  if (blockedCooldown && !blockedCooldown.available) {
    setNotice(
      t("5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.", {
        duration: formatDuration(blockedCooldown.remainingMs),
      }),
    );
    return;
  }

  setNotice(t("지진/지진해일 업데이트 중"));
  setProgress({
    currentStep: t("기상청 지진/지진해일 정보 요청 중"),
    percent: 35,
    title: t("재난 이벤트 갱신"),
  });

  try {
    await ensureSudoSession();
    const response = await fetch("/api/hazards/update", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        await parseUpdateError(response, t("지진/지진해일 업데이트 실패"), t),
      );
    }

    setProgress({
      currentStep: t("갱신 결과 불러오는 중"),
      percent: 90,
      title: t("재난 이벤트 갱신"),
    });
    await refreshStatus();
    setNotice(t("지진/지진해일 업데이트 완료"));
    setProgress({
      currentStep: t("완료"),
      percent: 100,
      title: t("재난 이벤트 갱신"),
    });
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error));
  } finally {
    window.setTimeout(() => setProgress(null), 500);
  }
}

export function DatasetUpdateConsole({
  dictionary,
  initialDatasets,
  initialCooldowns,
  ensureSudoSession,
}: {
  dictionary: AppDictionary;
  initialDatasets: DatasetStatus[];
  initialCooldowns: UpdateCooldown[];
  ensureSudoSession: () => Promise<void>;
}) {
  const progressTitleId = useId();
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      uiText(dictionary, key, values),
    [dictionary],
  );
  const [datasets, setDatasets] = useState<DatasetStatus[]>(initialDatasets);
  const [cooldowns, setCooldowns] =
    useState<UpdateCooldown[]>(initialCooldowns);
  const [activeUpdate, setActiveUpdate] = useState<DatasetSourceId | "all">();
  const [activeDatasetSource, setActiveDatasetSource] =
    useState<DatasetSourceId>();
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const cooldownByAction = useMemo(
    () => new Map(cooldowns.map((cooldown) => [cooldown.action, cooldown])),
    [cooldowns],
  );

  const isUpdating = Boolean(activeUpdate) || Boolean(progress);

  const datasetProgress = useMemo<ProgressState | null>(() => {
    if (!activeUpdate) {
      return null;
    }

    const current =
      datasets.find((dataset) => dataset.id === activeDatasetSource) ??
      datasets.find(
        (dataset) => dataset.updateProgress?.status === "running",
      ) ??
      (activeUpdate === "all"
        ? null
        : datasets.find((dataset) => dataset.id === activeUpdate));
    const updateProgress = current?.updateProgress;

    if (!updateProgress) {
      return {
        currentStep: t("업데이트 요청을 서버에 전달하고 있습니다."),
        percent: 1,
        title:
          activeUpdate === "all" ? t("전체 데이터 갱신") : t("데이터셋 갱신"),
      };
    }

    return {
      currentStep: `${current.label}: ${updateProgress.message}`,
      percent: updateProgress.percent,
      title:
        activeUpdate === "all"
          ? t("전체 데이터 갱신")
          : `${current.label} ${t("갱신")}`,
    };
  }, [activeDatasetSource, activeUpdate, datasets, t]);

  const visibleProgress = progress ?? datasetProgress;

  const refreshStatus = useCallback(async () => {
    try {
      const [datasetsResponse, cooldownsResponse] = await Promise.all([
        fetch("/api/datasets", { cache: "no-store" }),
        fetch("/api/admin/update-cooldowns", { cache: "no-store" }),
      ]);

      if (datasetsResponse.ok && cooldownsResponse.ok) {
        setDatasets((await datasetsResponse.json()).datasets);
        setCooldowns((await cooldownsResponse.json()).cooldowns);
      }
    } catch {
      // ignore status fetch errors during updates
    }
  }, []);

  const getCooldown = useCallback(
    (action: string) => {
      const cooldown = cooldownByAction.get(action);
      // Force trigger refresh on clockTick changes
      void clockTick;
      return calculateCooldown(cooldown);
    },
    [cooldownByAction, clockTick],
  );

  const datasetCooldown = useCallback(
    (source: DatasetSourceId) => getCooldown(`dataset:${source}`),
    [getCooldown],
  );

  const handleUpdateDataset = useCallback(
    (source: DatasetSourceId | "all", updateMode?: "restart" | "resume") => {
      void performDatasetUpdate({
        source,
        updateMode,
        datasets,
        datasetCooldown,
        ensureSudoSession,
        t,
        setActiveUpdate,
        setNotice,
        setActiveDatasetSource,
        refreshStatus,
      });
    },
    [datasets, datasetCooldown, ensureSudoSession, t, refreshStatus],
  );

  const handleUpdateHazards = useCallback(() => {
    void performHazardsUpdate({
      getCooldown,
      ensureSudoSession,
      t,
      setNotice,
      setProgress,
      refreshStatus,
    });
  }, [getCooldown, ensureSudoSession, t, refreshStatus]);

  useEffect(() => {
    if (!(activeUpdate || progress)) {
      return;
    }

    const timer = window.setInterval(() => {
      refreshStatus().catch(() => {
        /* ignore status fetch errors */
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeUpdate, progress, refreshStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const allDatasetCooldown =
    datasets
      .map((dataset) => datasetCooldown(dataset.id))
      .find((cooldown) => cooldown && !cooldown.available) ?? null;
  const hazardsCooldown = getCooldown("hazards");
  const pausedDatasets = datasets.filter(
    (dataset) => dataset.importProgress?.status === "paused",
  );

  return (
    <DatasetUpdateConsoleView
      activeUpdate={activeUpdate}
      allDatasetCooldown={allDatasetCooldown}
      datasetCooldown={datasetCooldown}
      datasets={datasets}
      dictionary={dictionary}
      hazardsCooldown={hazardsCooldown}
      isUpdating={isUpdating}
      notice={notice}
      onUpdateDataset={handleUpdateDataset}
      onUpdateHazards={handleUpdateHazards}
      pausedDatasets={pausedDatasets}
      progressTitleId={progressTitleId}
      visibleProgress={visibleProgress}
    />
  );
}
