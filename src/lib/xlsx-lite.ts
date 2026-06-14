import { read, utils } from "@e965/xlsx";

function cellText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function parseFirstWorksheetRows(buffer: Buffer) {
  const workbook = read(buffer, {
    cellDates: false,
    raw: false,
    type: "buffer",
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("XLSX first worksheet was not found.");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error("XLSX first worksheet was not found.");
  }

  const rows = utils.sheet_to_json<unknown[]>(worksheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false,
  });

  return rows.map((row) => row.map(cellText));
}
