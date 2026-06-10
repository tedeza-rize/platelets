import type { DatasetSourceId } from "@/lib/dataset-sources";

export type DatasetUpdateStage =
  | "preparing"
  | "requesting"
  | "receiving"
  | "processing"
  | "saving"
  | "completed"
  | "failed";

export type DatasetUpdateProgress = {
  message: string;
  percent: number;
  source: DatasetSourceId;
  stage: DatasetUpdateStage;
  status: "completed" | "failed" | "running";
  updatedAt: string;
};

export type DatasetProgressReporter = (
  stage: DatasetUpdateStage,
  percent: number,
  message: string,
) => Promise<void>;
