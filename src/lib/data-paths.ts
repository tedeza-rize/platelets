import path from "node:path";

export function getDataDirectoryPath() {
  const configuredDirectory = process.env.PLATELETS_DATA_DIR;

  if (!configuredDirectory) {
    return path.join(process.cwd(), "data");
  }

  return path.isAbsolute(configuredDirectory)
    ? configuredDirectory
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredDirectory);
}

export function getSqliteDatabasePath() {
  return path.join(getDataDirectoryPath(), "points.sqlite");
}
