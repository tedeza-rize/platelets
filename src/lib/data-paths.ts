import path from "node:path";

declare global {
  var __plateletsDataDirectoryOverride: string | undefined;
}

export function getDataDirectoryPath() {
  return (
    globalThis.__plateletsDataDirectoryOverride ??
    path.join(process.cwd(), "data")
  );
}

export function getSqliteDatabasePath() {
  return path.join(getDataDirectoryPath(), "points.sqlite");
}

export function setDataDirectoryPathForTests(directory: string) {
  globalThis.__plateletsDataDirectoryOverride = path.resolve(directory);
}
