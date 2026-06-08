import { noStoreJson } from "@/lib/http";
import {
  getConfiguredNtpServers,
  saveConfiguredNtpServers,
} from "@/lib/time-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const servers = await getConfiguredNtpServers();

  return noStoreJson({ servers });
}

export async function PUT(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    servers?: unknown;
  } | null;

  if (!Array.isArray(payload?.servers)) {
    return noStoreJson({ error: "servers must be an array" }, { status: 400 });
  }

  try {
    const servers = await saveConfiguredNtpServers(
      payload.servers.map((server) => String(server)),
    );

    return noStoreJson({ servers });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
