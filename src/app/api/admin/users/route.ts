import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import { createUser, listUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = await requireAccessRole(request, "admin");
  if (forbidden) return forbidden;

  return noStoreJson({ users: await listUsers() });
}

export async function POST(request: Request) {
  const forbidden = await requireAccessRole(request, "admin");
  if (forbidden) return forbidden;

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ error: "User payload is required." }, { status: 400 });
  }

  try {
    return noStoreJson({ user: await createUser(payload) }, { status: 201 });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
