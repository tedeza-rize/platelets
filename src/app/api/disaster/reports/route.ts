import { buildDisasterReportWorkbook } from "@/lib/disaster-response/report-export";
import { noStoreJson } from "@/lib/http";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reportFormat(request: Request) {
  return (
    new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "excel"
  );
}

export async function GET(request: Request) {
  const format = reportFormat(request);

  if (format !== "excel" && format !== "xls") {
    return noStoreJson({ error: "unsupported-report-format" }, { status: 400 });
  }

  const dictionary = getDictionary(await getRequestLocale());
  const workbook = await buildDisasterReportWorkbook({ dictionary });

  return new Response(workbook.body, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${workbook.filename}"`,
      "Content-Type": workbook.contentType,
    },
  });
}
