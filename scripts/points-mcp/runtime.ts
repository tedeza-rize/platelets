import path from "node:path";
import { loadMcpRuntimeApiKeys } from "../mcp-runtime-config.ts";

export const projectRoot = process.cwd();
export const dataDirectory = path.join(projectRoot, "data");
export const databasePath = path.join(dataDirectory, "points.sqlite");
export const runtimeApiKeys = loadMcpRuntimeApiKeys(
  databasePath,
  dataDirectory,
);
export const forecastDocPath = path.join(
  projectRoot,
  "docs",
  "AI_FORECAST_AND_RESPONSE.md",
);
