const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

export function databaseParams(params: readonly unknown[]) {
  return params.map((value) =>
    typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value,
  );
}

export function normalizeDatabaseRow<T>(row: T): T {
  if (!(row && typeof row === "object")) {
    return row;
  }

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as T;
}
