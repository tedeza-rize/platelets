import {
  deleteManagedUser,
  type UserManagementErrorCode,
  updateManagedUser,
} from "@/features/users/user-account-service";
import { requireAccessSession } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  const [result, error] = await updateManagedUser(
    { id: session.userId, role: session.role },
    id,
    payload,
  );

  return error
    ? noStoreJson(
        { errorCode: error.code },
        { status: userErrorStatus(error.code) },
      )
    : noStoreJson(result);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const [session, forbidden] = await requireAccessSession(request, "admin");
  if (forbidden) return forbidden;

  if (
    !session.userId ||
    (session.role !== "admin" && session.role !== "sudo")
  ) {
    return noStoreJson({ errorCode: "session_required" }, { status: 401 });
  }

  const { id } = await context.params;
  const [result, error] = await deleteManagedUser(
    { id: session.userId, role: session.role },
    id,
  );

  return error
    ? noStoreJson(
        { errorCode: error.code },
        { status: userErrorStatus(error.code) },
      )
    : noStoreJson(result);
}

function userErrorStatus(code: UserManagementErrorCode) {
  if (code === "not_found") return 404;
  if (code === "protected_account" || code === "sudo_required") return 403;
  if (
    code === "last_admin" ||
    code === "self_delete" ||
    code === "self_role_change"
  ) {
    return 409;
  }
  return 400;
}
