import assert from "node:assert/strict";
import test from "node:test";
import { utils, write } from "@e965/xlsx";
import { parseFirstWorksheetRows } from "@/lib/xlsx-lite";

test("parseFirstWorksheetRows reads the first worksheet with SheetJS", () => {
  const workbook = utils.book_new();
  const worksheet = utils.aoa_to_sheet([
    ["name", "count", "note"],
    ["fire-water-source", 12, "sample"],
    ["fire-safety-target", 7, ""],
  ]);
  utils.book_append_sheet(workbook, worksheet, "sample_info");
  const buffer = Buffer.from(
    write(workbook, { bookType: "xlsx", type: "buffer" }),
  );

  assert.deepEqual(parseFirstWorksheetRows(buffer), [
    ["name", "count", "note"],
    ["fire-water-source", "12", "sample"],
    ["fire-safety-target", "7", ""],
  ]);
});
