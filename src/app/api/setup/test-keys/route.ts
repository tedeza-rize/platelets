import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function urlOk(value: unknown) {
  if (!present(value)) {
    return true;
  }

  try {
    const url = new URL(String(value));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ error: "Invalid API key payload." }, { status: 400 });
  }

  const checks = [
    {
      id: "openai",
      ok: !present(payload.openaiApiKey) || urlOk(payload.openaiBaseUrl),
      title: "OpenAI configuration",
    },
    {
      id: "public-data",
      ok: true,
      title: "Public data service key",
    },
    {
      id: "kakao",
      ok: true,
      title: "Kakao REST keys",
    },
    {
      id: "seoul",
      ok: true,
      title: "Seoul Open API key",
    },
    {
      id: "vworld",
      ok: true,
      title: "VWorld key",
    },
  ];

  return noStoreJson({
    checks,
    ok: checks.every((check) => check.ok),
  });
}
