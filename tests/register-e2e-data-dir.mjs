import { readFileSync } from "node:fs";
import path from "node:path";

const metadataPath = path.join(
  process.cwd(),
  ".playwright-data",
  "active.json",
);
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

globalThis.__plateletsDataDirectoryOverride = metadata.dataDirectory;
