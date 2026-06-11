import { readSheet } from "read-excel-file/node";

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export async function parseFirstWorksheetRows(buffer: Buffer) {
  const rows = await readSheet(buffer, 1);

  return rows.map((row) => row.map(stringifyCell));
}
