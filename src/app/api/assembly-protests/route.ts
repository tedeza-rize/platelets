import {
  getAssemblyProtests,
  isAssemblyPoliceAgency,
} from "@/lib/assembly-protests";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null) {
  if (!value) return;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = parseDate(url.searchParams.get("date"));
  const agency = url.searchParams.get("agency");

  if (date === null) {
    return noStoreJson(
      { error: "date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  if (agency && !isAssemblyPoliceAgency(agency)) {
    return noStoreJson({ error: "Unknown agency." }, { status: 400 });
  }

  const protests = (await getAssemblyProtests({ date })).filter(
    (protest) => !agency || protest.sourceId === agency,
  );

  return noStoreJson({
    protests: protests.map(({ raw: _raw, ...protest }) => protest),
  });
}
