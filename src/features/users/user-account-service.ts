import { revokeUserAccessSessions } from "@/lib/auth-sessions";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  type UserAccount,
  type UserAccountInput,
  type UserRole,
  updateUser,
} from "@/lib/users";
import { fail, type GoResult, ok } from "@/shared/result";

export type UserManagementActor = {
  id: string;
  role: "admin" | "sudo";
};

export type UserManagementErrorCode =
  | "invalid_input"
  | "last_admin"
  | "not_found"
  | "protected_account"
  | "self_delete"
  | "self_role_change"
  | "sudo_required";

export type UserManagementError = {
  code: UserManagementErrorCode;
};

export type UserUpdateResult = {
  sessionRevoked: boolean;
  user: UserAccount;
};

const USER_ROLES = new Set<UserRole>([
  "admin",
  "dispatcher",
  "field_worker",
  "sudo",
]);

function inputRole(input: UserAccountInput): UserRole | null {
  if (input.role === undefined) return null;
  return typeof input.role === "string" &&
    USER_ROLES.has(input.role as UserRole)
    ? (input.role as UserRole)
    : null;
}

function isAdminCapable(role: UserRole) {
  return role === "admin" || role === "sudo";
}

function changesSessionIdentity(input: UserAccountInput) {
  return (
    input.password !== undefined ||
    input.role !== undefined ||
    input.username !== undefined
  );
}

async function isLastAdminCapableAccount(target: UserAccount, role: UserRole) {
  if (!isAdminCapable(target.role) || isAdminCapable(role)) {
    return false;
  }

  const users = await listUsers();
  return users.filter((user) => isAdminCapable(user.role)).length <= 1;
}

function canManageTarget(
  actor: UserManagementActor,
  target: UserAccount,
): UserManagementError | null {
  if (target.role === "sudo" && actor.role !== "sudo") {
    return { code: "sudo_required" };
  }

  return null;
}

export async function createManagedUser(
  actor: UserManagementActor,
  input: UserAccountInput,
): Promise<GoResult<UserAccount, UserManagementError>> {
  const role = inputRole(input);

  if (role === null) {
    return fail({ code: "invalid_input" });
  }

  if (role === "sudo" && actor.role !== "sudo") {
    return fail({ code: "sudo_required" });
  }

  const [user, error] = await createUser(input);
  if (error !== null) {
    return fail({ code: "invalid_input" });
  }
  return ok(user);
}

export async function updateManagedUser(
  actor: UserManagementActor,
  id: string,
  input: UserAccountInput,
): Promise<GoResult<UserUpdateResult, UserManagementError>> {
  const target = await getUserById(id);

  if (!target) {
    return fail({ code: "not_found" });
  }

  const targetError = canManageTarget(actor, target);
  if (targetError) return fail(targetError);

  const role = inputRole(input) ?? target.role;
  if (input.role !== undefined && inputRole(input) === null) {
    return fail({ code: "invalid_input" });
  }

  if (role === "sudo" && actor.role !== "sudo") {
    return fail({ code: "sudo_required" });
  }

  if (target.username === "sudo") {
    const username = String(input.username ?? target.username)
      .trim()
      .toLowerCase();

    if (username !== "sudo" || role !== "sudo") {
      return fail({ code: "protected_account" });
    }
  }

  if (actor.id === target.id && role !== target.role) {
    return fail({ code: "self_role_change" });
  }

  if (await isLastAdminCapableAccount(target, role)) {
    return fail({ code: "last_admin" });
  }

  const [user, error] = await updateUser(id, input);
  if (error !== null || !user) return fail({ code: "invalid_input" });

  const sessionRevoked = changesSessionIdentity(input);
  if (sessionRevoked) {
    await revokeUserAccessSessions(id);
  }

  return ok({ sessionRevoked, user });
}

export async function deleteManagedUser(
  actor: UserManagementActor,
  id: string,
): Promise<GoResult<{ deleted: true }, UserManagementError>> {
  const target = await getUserById(id);

  if (!target) {
    return fail({ code: "not_found" });
  }

  if (actor.id === target.id) {
    return fail({ code: "self_delete" });
  }

  const targetError = canManageTarget(actor, target);
  if (targetError) return fail(targetError);

  if (target.username === "sudo") {
    return fail({ code: "protected_account" });
  }

  if (
    isAdminCapable(target.role) &&
    (await listUsers()).filter((user) => isAdminCapable(user.role)).length <= 1
  ) {
    return fail({ code: "last_admin" });
  }

  const deleted = await deleteUser(id);
  if (!deleted) return fail({ code: "not_found" });

  await revokeUserAccessSessions(id);
  return ok({ deleted: true });
}
