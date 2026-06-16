import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";
import type { AssemblyProtestInput } from "@/lib/points-db";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-assembly-db-"),
);
setDataDirectoryPathForTests(dataDirectory);

export const pointsDb = await import("@/lib/points-db");
export const assemblyProtests = await import("@/lib/assembly-protests");
export const assemblyRoute = await import("@/app/api/assembly-protests/route");

export function protest(
  patch: Partial<AssemblyProtestInput> &
    Pick<AssemblyProtestInput, "sourceRecordId">,
): AssemblyProtestInput {
  return {
    agency: "Seoul Metropolitan Police Agency",
    crowdSize: 30,
    date: "2026-06-13",
    detailUrl: "https://example.test/detail",
    endsAt: "2026-06-13T10:30:00+09:00",
    latitude: 37.5665,
    location: "Seoul Plaza",
    locationScope: "Seoul Plaza sidewalk",
    longitude: 126.978,
    raw: { source: "unit" },
    sourceId: "seoul",
    sourceTitle: "Daily assembly 260613",
    sourceUrl: "https://example.test/list",
    startsAt: "2026-06-13T10:00:00+09:00",
    ...patch,
  };
}

export function buildTextPdf(lines: string[]) {
  const escapePdfText = (value: string) =>
    value.replace(/[\\()]/g, (match) => `\\${match}`);
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -18 Td",
      `(${escapePdfText(line)}) Tj`,
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}
