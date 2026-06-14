import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import { deleteUser, updateUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    const { id } = await context.params;
    const user = await updateUser(id, payload);

    return user
      ? noStoreJson({ user })
      : noStoreJson({ error: "User was not found." }, { status: 404 });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const forbidden = await requireAccessRole(request, "admin");
  if (forbidden) return forbidden;

  const { id } = await context.params;
  const deleted = await deleteUser(id);

  return deleted
    ? noStoreJson({ deleted: true })
    : noStoreJson({ error: "User was not found." }, { status: 404 });
}
