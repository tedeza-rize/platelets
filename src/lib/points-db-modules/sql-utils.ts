export function nextKstMidnight(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  });
  const parts = new Map(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  const year = Number(parts.get("year"));
  const month = Number(parts.get("month"));
  const day = Number(parts.get("day"));

  return new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0));
}

export function buildSqlPlaceholders(count: number, separator = ",") {
  if (!Number.isSafeInteger(count) || count < 1) {
    return "?";
  }

  return Array.from({ length: count }, () => "?").join(separator);
}

export function buildWhitelistedWhereClause(
  ids: readonly string[],
  clauses: Readonly<Record<string, string>>,
) {
  const selected = ids.flatMap((id) =>
    Object.hasOwn(clauses, id) ? [clauses[id]] : [],
  );

  return selected.length > 0 ? `WHERE ${selected.join(" AND ")}` : "";
}
