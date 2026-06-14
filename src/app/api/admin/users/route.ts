import { createManagedUser } from "@/features/users/user-account-service";
import { requireAccessSession } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [session, forbidden] = await requireAccessSession(request, "admin");
  if (forbidden) return forbidden;

  return noStoreJson({
    currentUserId: session.userId,
    users: await listUsers(),
    viewerRole: session.role,
  });
}

export async function POST(request: Request) {
  const [session, forbidden] = await requireAccessSession(request, "admin");
  if (forbidden) return forbidden;

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ errorCode: "invalid_input" }, { status: 400 });
  }

  if (
    !session.userId ||
    (session.role !== "admin" && session.role !== "sudo")
  ) {
    return noStoreJson({ errorCode: "session_required" }, { status: 401 });
  }

  const [user, error] = await createManagedUser(
    { id: session.userId, role: session.role },
    payload,
  );

  return error
    ? noStoreJson(
        { errorCode: error.code },
        { status: userErrorStatus(error.code) },
      )
    : noStoreJson({ user }, { status: 201 });
}

function userErrorStatus(code: string) {
  return code === "sudo_required" ? 403 : 400;
}
